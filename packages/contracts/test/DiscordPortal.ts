import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, it } from 'node:test';

import { network } from 'hardhat';
import {
  encodeAbiParameters,
  getAddress,
  getContract,
  type Abi,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const SCHEMA_ID = '0xefa96ce61912c5bb59cb4c26645ea193fc03a234fe09a6b2c8b85aaa51a382d6';
const FEE = 100_000_000_000_000n;
const CONTRACTS_ROOT = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const PRODUCTION_SIGNER_DECLARATION =
  'address public constant SIGNER_ADDRESS = 0x6aDD17d22E8753869a3B9E83068Be1f16202046E;';

const compileEphemeralSignerFixture = async (signerAddress: Address) => {
  const productionSource = readFileSync(resolve(CONTRACTS_ROOT, 'src/DiscordPortal.sol'), 'utf8');
  assert.equal(productionSource.split(PRODUCTION_SIGNER_DECLARATION).length - 1, 1);
  const fixtureDeclaration = `address public constant SIGNER_ADDRESS = ${signerAddress};`;
  const fixtureSource = productionSource.replace(PRODUCTION_SIGNER_DECLARATION, fixtureDeclaration);
  assert.equal(
    fixtureSource.replace(fixtureDeclaration, PRODUCTION_SIGNER_DECLARATION),
    productionSource,
    'the ephemeral fixture may change only the signer constant',
  );

  const sources: Record<string, { content: string }> = {};
  const addSource = (sourceKey: string, sourcePath: string): void => {
    if (sources[sourceKey]) return;
    const content = readFileSync(sourcePath, 'utf8');
    sources[sourceKey] = { content };
    const importPattern = /\bimport\s+(?:[^;"']*?\sfrom\s*)?["']([^"']+)["']\s*;/g;
    for (const [, importPath] of content.matchAll(importPattern)) {
      if (!importPath) continue;
      const dependencyPath = importPath.startsWith('.')
        ? resolve(dirname(sourcePath), importPath)
        : require.resolve(importPath, { paths: [dirname(sourcePath), CONTRACTS_ROOT] });
      const dependencyKey = posix.normalize(
        importPath.startsWith('.') ? posix.join(posix.dirname(sourceKey), importPath) : importPath,
      );
      addSource(dependencyKey, dependencyPath);
    }
  };
  addSource('src/DiscordPortal.sol', resolve(CONTRACTS_ROOT, 'src/DiscordPortal.sol'));
  sources['src/DiscordPortal.sol'] = { content: fixtureSource };

  const input = {
    language: 'Solidity',
    sources,
    settings: {
      evmVersion: 'shanghai',
      optimizer: { enabled: true, runs: 2000 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  };
  const hardhatEntry = require.resolve('hardhat');
  const compilerModulePath = resolve(
    dirname(hardhatEntry),
    'internal/builtin-plugins/solidity/build-system/compiler/index.js',
  );
  const { getCompiler } = await import(pathToFileURL(compilerModulePath).href);
  const compiler = await getCompiler('0.8.21', { preferWasm: false });
  const compilerOutput = await compiler.compile(input);
  const output = (
    typeof compilerOutput === 'string' ? JSON.parse(compilerOutput) : compilerOutput
  ) as {
    errors?: Array<{ severity: string; formattedMessage: string }>;
    contracts?: Record<string, Record<string, { abi: Abi; evm: { bytecode: { object: string } } }>>;
  };
  const errors = output.errors?.filter(({ severity }) => severity === 'error') ?? [];
  assert.deepEqual(errors, [], errors.map(({ formattedMessage }) => formattedMessage).join('\n'));
  const artifact = output.contracts?.['src/DiscordPortal.sol']?.DiscordPortal;
  assert.ok(artifact?.evm.bytecode.object, 'fixture compilation must produce deployable bytecode');
  return { abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` as Hex };
};

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
  const [subject, other, portalOwner] = accounts;

  let portal: Awaited<ReturnType<typeof viem.deployContract<'DiscordPortal'>>>;
  let attestationRegistry: Awaited<
    ReturnType<typeof viem.deployContract<'PortalTestAttestationRegistry'>>
  >;
  let routerAddress: Address;

  beforeEach(async () => {
    const moduleRegistry = await viem.deployContract('PortalTestModuleRegistry');
    attestationRegistry = await viem.deployContract('PortalTestAttestationRegistry');
    const portalRegistry = await viem.deployContract('PortalTestRegistry', [
      portalOwner!.account.address,
    ]);
    const router = await viem.deployContract('PortalTestRouter', [
      attestationRegistry.address,
      moduleRegistry.address,
      portalRegistry.address,
    ]);
    routerAddress = router.address;
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

  it('accepts a real EIP-712 signature with an ephemeral local signer and exact production source', async () => {
    const ephemeralSigner = privateKeyToAccount(`0x${'77'.repeat(32)}` as Hex);
    const fixture = await compileEphemeralSignerFixture(ephemeralSigner.address);
    const deploymentHash = await subject.deployContract({
      abi: fixture.abi,
      bytecode: fixture.bytecode,
      args: [[], routerAddress],
    });
    const deployment = await publicClient.waitForTransactionReceipt({ hash: deploymentHash });
    assert.ok(deployment.contractAddress);
    const fixturePortal = getContract({
      address: deployment.contractAddress,
      abi: fixture.abi,
      client: { public: publicClient, wallet: subject },
    });
    const expirationDate = 1_900_000_000;
    const guild = { id: 456n, name: 'EIP-712 positive fixture' };
    const chainId = await publicClient.getChainId();
    const domain = {
      name: 'VerifyDiscord',
      version: '1',
      chainId,
      verifyingContract: getAddress(fixturePortal.address),
    };
    const types = {
      Discord: [
        { name: 'id', type: 'uint256' },
        { name: 'name', type: 'string' },
        { name: 'subject', type: 'address' },
        { name: 'expirationDate', type: 'uint64' },
      ],
    } as const;
    const attestationData = encodeAbiParameters(
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
    const payload = {
      schemaId: SCHEMA_ID,
      expirationDate,
      subject: subject.account.address,
      attestationData,
    };
    const sign = (
      options: {
        domain?: typeof domain;
        subject?: Address;
        guildId?: bigint;
        guildName?: string;
        expirationDate?: number;
      } = {},
    ) =>
      ephemeralSigner.signTypedData({
        domain: options.domain ?? domain,
        types,
        primaryType: 'Discord',
        message: {
          id: options.guildId ?? guild.id,
          name: options.guildName ?? guild.name,
          subject: options.subject ?? subject.account.address,
          expirationDate: options.expirationDate ?? expirationDate,
        },
      });

    const validSignature = await sign();
    await fixturePortal.write.attest([payload, [validSignature]], {
      account: subject.account,
      value: FEE,
    });
    assert.equal(await attestationRegistry.read.attestCount(), 1n);
    assert.equal(
      getAddress(await attestationRegistry.read.lastAttester()),
      getAddress(subject.account.address),
    );
    assert.equal(await attestationRegistry.read.lastExpirationDate(), BigInt(expirationDate));

    const wrongDomain = await sign({ domain: { ...domain, chainId: chainId + 1 } });
    await rejectsWith(
      fixturePortal.write.attest([payload, [wrongDomain]], {
        account: subject.account,
        value: FEE,
      }),
      /InvalidSignature/,
    );
    const wrongSubject = await sign({ subject: other.account.address });
    await rejectsWith(
      fixturePortal.write.attest([payload, [wrongSubject]], {
        account: subject.account,
        value: FEE,
      }),
      /InvalidSignature/,
    );
    const wrongGuildId = await sign({ guildId: guild.id + 1n });
    await rejectsWith(
      fixturePortal.write.attest([payload, [wrongGuildId]], {
        account: subject.account,
        value: FEE,
      }),
      /InvalidSignature/,
    );
    const wrongGuildName = await sign({ guildName: `${guild.name} altered` });
    await rejectsWith(
      fixturePortal.write.attest([payload, [wrongGuildName]], {
        account: subject.account,
        value: FEE,
      }),
      /InvalidSignature/,
    );
    const wrongExpiration = await sign({ expirationDate: expirationDate + 1 });
    await rejectsWith(
      fixturePortal.write.attest([payload, [wrongExpiration]], {
        account: subject.account,
        value: FEE,
      }),
      /InvalidSignature/,
    );
    assert.equal(await attestationRegistry.read.attestCount(), 1n);

    // The portal signs an expiry but has no replay guard; Verax assigns a fresh ID per write.
    await fixturePortal.write.attest([payload, [validSignature]], {
      account: subject.account,
      value: FEE,
    });
    assert.equal(await attestationRegistry.read.attestCount(), 2n);

    // Verax documents that expired attestations can be registered; expiry is not a signature TTL.
    const block = await publicClient.getBlock();
    const expiredDate = Number(block.timestamp) - 3_600;
    const expiredSignature = await sign({ expirationDate: expiredDate });
    await fixturePortal.write.attest(
      [{ ...payload, expirationDate: expiredDate }, [expiredSignature]],
      { account: subject.account, value: FEE },
    );
    assert.equal(await attestationRegistry.read.attestCount(), 3n);
    assert.equal(await attestationRegistry.read.lastExpirationDate(), BigInt(expiredDate));

    await attestationRegistry.write.setShouldRevert([true]);
    await rejectsWith(
      fixturePortal.write.attest([payload, [validSignature]], {
        account: subject.account,
        value: FEE,
      }),
      /RegistryWriteFailed/,
    );
    assert.equal(await attestationRegistry.read.attestCount(), 3n);
    assert.equal(await attestationRegistry.read.lastExpirationDate(), BigInt(expiredDate));
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
