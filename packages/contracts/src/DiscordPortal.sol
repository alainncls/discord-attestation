// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AbstractPortalV2} from "@verax-attestation-registry/verax-contracts/contracts/abstracts/AbstractPortalV2.sol";
import {AttestationPayload} from "@verax-attestation-registry/verax-contracts/contracts/types/Structs.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title eFrogs Portal
 * @author alainnicolas.eth
 * @notice This contract aims to attest of the presence in a Discord server
 */
contract DiscordPortal is AbstractPortalV2, Ownable, EIP712 {
    uint256 public fee = 0.0001 ether;
    address public constant SIGNER_ADDRESS = 0x6aDD17d22E8753869a3B9E83068Be1f16202046E;
    bytes32 public constant SCHEMA_ID = 0xefa96ce61912c5bb59cb4c26645ea193fc03a234fe09a6b2c8b85aaa51a382d6;
    string private constant SIGNING_DOMAIN = "VerifyDiscord";
    string private constant SIGNATURE_VERSION = "1";

    error InvalidSchema();
    error InvalidSubject();
    error SenderIsNotSubject();
    error InsufficientFee();
    error InvalidSignature();
    error InvalidSignatureLength();
    error NotImplemented();

    struct GuildPayload {
        uint256 guildId;
        string guildName;
    }

    constructor(
        address[] memory modules,
        address router
    ) AbstractPortalV2(modules, router) EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {}

    /**
     * @inheritdoc AbstractPortalV2
     * @dev This function checks if
     *          the subject is a valid address,
     *          and if the value sent is sufficient
     *          and if the schema ID is correct
     *          and if the payload is correctly signed
     */
    function _onAttest(
        AttestationPayload memory attestationPayload,
        bytes[] memory validationPayloads,
        uint256 value
    ) internal view override {
        if (attestationPayload.subject.length != 20) revert InvalidSubject();
        address subject = address(uint160(bytes20(attestationPayload.subject)));

        if (value < fee) revert InsufficientFee();
        if (attestationPayload.schemaId != SCHEMA_ID) revert InvalidSchema();

        GuildPayload memory payload = abi.decode(attestationPayload.attestationData, (GuildPayload));
        if (!verifySignature(validationPayloads[0], payload.guildId, subject)) revert InvalidSignature();
    }

    /**
     *  @inheritdoc AbstractPortalV2
     */
    function _onReplace(
        bytes32 /*attestationId*/,
        AttestationPayload memory /*attestationPayload*/,
        address /*attester*/,
        uint256 /*value*/
    ) internal view override {
        if (msg.sender != portalRegistry.getPortalByAddress(address(this)).ownerAddress) revert OnlyPortalOwner();
    }

    /**
     * @inheritdoc AbstractPortalV2
     */
    function _onBulkReplace(
        bytes32[] memory /*attestationIds*/,
        AttestationPayload[] memory /*attestationsPayloads*/,
        bytes[][] memory /*validationPayloads*/
    ) internal view override {
        if (msg.sender != portalRegistry.getPortalByAddress(address(this)).ownerAddress) revert OnlyPortalOwner();
    }

    /**
     * @inheritdoc AbstractPortalV2
     * @dev This function is not implemented
     */
    function _onBulkAttest(
        AttestationPayload[] memory /*attestationsPayloads*/,
        bytes[][] memory /*validationPayloads*/
    ) internal pure override {
        revert NotImplemented();
    }

    /**
     * @inheritdoc AbstractPortalV2
     * @dev Only the Portal owner can revoke attestations
     */
    function _onRevoke(bytes32 /*attestationId*/) internal view override {
        if (msg.sender != portalRegistry.getPortalByAddress(address(this)).ownerAddress) revert OnlyPortalOwner();
    }

    /**
     * @inheritdoc AbstractPortalV2
     * @dev Only the Portal owner can revoke attestations
     */
    function _onBulkRevoke(bytes32[] memory /*attestationIds*/) internal view override {
        if (msg.sender != portalRegistry.getPortalByAddress(address(this)).ownerAddress) revert OnlyPortalOwner();
    }

    /**
     * @notice Set the fee required to attest
     * @param attestationFee The fee required to attest
     */
    function setFee(uint256 attestationFee) public onlyOwner {
        fee = attestationFee;
    }

    function verifySignature(bytes memory signature, uint256 guildId, address subject) internal view returns (bool) {
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(keccak256("Discord(uint256 id,address subject)"), guildId, subject))
        );
        address signer = ECDSA.recover(digest, signature);
        return signer == SIGNER_ADDRESS;
    }
}
