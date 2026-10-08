import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { network } from 'hardhat';
import { encodeAbiParameters } from 'viem';

const SCHEMA_ID = '0xefa96ce61912c5bb59cb4c26645ea193fc03a234fe09a6b2c8b85aaa51a382d6';
const FEE = 100_000_000_000_000n;

async function rejectsWith(promise: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(promise, (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, pattern);
    return true;
  });
}

describe('DiscordPortal public attestation boundary', async function () {
  const { viem } = await network.create('hardhat');
  const accounts = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();
  const [subject, other] = accounts;

  let portal: Awaited<ReturnType<typeof viem.deployContract<'DiscordPortal'>>>;
  let attestationRegistry: Awaited<
    ReturnType<typeof viem.deployContract<'PortalTestAttestationRegistry'>>
  >;

  beforeEach(async () => {
    const moduleRegistry = await viem.deployContract('PortalTestModuleRegistry');
    attestationRegistry = await viem.deployContract('PortalTestAttestationRegistry');
    const portalRegistry = await viem.deployContract('PortalTestRegistry', [
      subject.account.address,
    ]);
    const router = await viem.deployContract('PortalTestRouter', [
      attestationRegistry.address,
      moduleRegistry.address,
      portalRegistry.address,
    ]);
    portal = await viem.deployContract('DiscordPortal', [[], router.address]);
  });

  it('rejects unsupported schema, invalid subject, sender mismatch, insufficient fee and missing signatures', async () => {
    const expirationDate = 1_900_000_000;
    const encoded = encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { name: 'guildId', type: 'uint256' },
            { name: 'guildName', type: 'string' },
          ],
        },
      ],
      [{ guildId: 123n, guildName: 'Guild' }],
    );
    const payload = {
      schemaId: SCHEMA_ID,
      expirationDate,
      subject: subject.account.address,
      attestationData: encoded,
    };

    await rejectsWith(
      portal.write.attest([{ ...payload, schemaId: `0x${'11'.repeat(32)}` }, ['0x']], {
        account: subject.account,
        value: FEE,
      }),
      /InvalidSchema/,
    );
    await rejectsWith(
      portal.write.attest([{ ...payload, subject: '0x1234' }, ['0x']], {
        account: subject.account,
        value: FEE,
      }),
      /InvalidSubject/,
    );
    await rejectsWith(
      portal.write.attest([payload, ['0x']], { account: other.account, value: FEE }),
      /SenderIsNotSubject/,
    );
    await rejectsWith(
      portal.write.attest([payload, ['0x']], { account: subject.account, value: FEE - 1n }),
      /InsufficientFee/,
    );
    await rejectsWith(
      portal.write.attest([payload, []], { account: subject.account, value: FEE }),
      /InvalidSignatureLength/,
    );
    assert.equal(await attestationRegistry.read.attestCount(), 0n);
  });

  it('rejects a well-formed EIP-712 signature from a non-authorized signer without registering data', async () => {
    const expirationDate = 1_900_000_000;
    const guild = { id: 123n, name: 'Guild' };
    const chainId = await publicClient.getChainId();
    const signature = await other.signTypedData({
      domain: {
        name: 'VerifyDiscord',
        version: '1',
        chainId,
        verifyingContract: portal.address,
      },
      types: {
        Discord: [
          { name: 'id', type: 'uint256' },
          { name: 'name', type: 'string' },
          { name: 'subject', type: 'address' },
          { name: 'expirationDate', type: 'uint64' },
        ],
      },
      primaryType: 'Discord',
      message: {
        id: guild.id,
        name: guild.name,
        subject: subject.account.address,
        expirationDate,
      },
    });
    const data = encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { name: 'guildId', type: 'uint256' },
            { name: 'guildName', type: 'string' },
          ],
        },
      ],
      [{ guildId: guild.id, guildName: guild.name }],
    );

    await rejectsWith(
      portal.write.attest(
        [
          {
            schemaId: SCHEMA_ID,
            expirationDate,
            subject: subject.account.address,
            attestationData: data,
          },
          [signature],
        ],
        { account: subject.account, value: FEE },
      ),
      /InvalidSignature/,
    );
    assert.equal(await attestationRegistry.read.attestCount(), 0n);
  });

  it('preserves fee administration and portal-owner operation guards', async () => {
    await portal.write.setFee([FEE * 2n], { account: subject.account });
    assert.equal(await portal.read.fee(), FEE * 2n);
    await rejectsWith(
      portal.write.setFee([0n], { account: other.account }),
      /Ownable: caller is not the owner/,
    );
    await rejectsWith(
      portal.write.revoke([`0x${'00'.repeat(32)}`], { account: other.account }),
      /OnlyPortalOwner/,
    );
    await rejectsWith(
      portal.write.replace(
        [
          `0x${'00'.repeat(32)}`,
          {
            schemaId: SCHEMA_ID,
            expirationDate: 0,
            subject: subject.account.address,
            attestationData: '0x01',
          },
          [],
        ],
        { account: other.account },
      ),
      /OnlyPortalOwner/,
    );
  });
});
