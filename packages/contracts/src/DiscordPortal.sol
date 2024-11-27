// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AbstractPortal} from "@verax-attestation-registry/verax-contracts/contracts/abstracts/AbstractPortal.sol";
import {AttestationPayload} from "@verax-attestation-registry/verax-contracts/contracts/types/Structs.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title eFrogs Portal
 * @author alainnicolas.eth
 * @notice This contract aims to attest of the presence in a Discord server
 */
contract DiscordPortal is AbstractPortal, Ownable, EIP712 {
    uint256 public fee = 0.0001 ether;
    address public constant SIGNER_ADDRESS = 0x6aDD17d22E8753869a3B9E83068Be1f16202046E;
    bytes32 public constant SCHEMA_ID = 0xa8d6aefe759739c13a4151523a525bfe88b7dae97bdd5de50dab89cb247690d4;
    string private constant SIGNING_DOMAIN = "VerifyDiscord";
    string private constant SIGNATURE_VERSION = "1";

    error InvalidSchema();
    error InvalidSubject();
    error SenderIsNotSubject();
    error InsufficientFee();
    error WithdrawFail();
    error InvalidSignature();
    error InvalidSignatureLength();
    error NotImplemented();

    constructor(
        address[] memory modules,
        address router
    ) AbstractPortal(modules, router) EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {}

    /**
     *  @inheritdoc AbstractPortal
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
     * @inheritdoc AbstractPortal
     */
    function _onBulkReplace(
        bytes32[] memory /*attestationIds*/,
        AttestationPayload[] memory /*attestationsPayloads*/,
        bytes[][] memory /*validationPayloads*/
    ) internal view override {
        if (msg.sender != portalRegistry.getPortalByAddress(address(this)).ownerAddress) revert OnlyPortalOwner();
    }

    /**
     * @inheritdoc AbstractPortal
     * @dev This function is not implemented
     */
    function _onBulkAttest(
        AttestationPayload[] memory /*attestationsPayloads*/,
        bytes[][] memory /*validationPayloads*/
    ) internal pure override {
        revert NotImplemented();
    }

    /**
     * @inheritdoc AbstractPortal
     * @dev Only the Portal owner can revoke attestations
     */
    function _onRevoke(bytes32 /*attestationId*/) internal view override {
        if (msg.sender != portalRegistry.getPortalByAddress(address(this)).ownerAddress) revert OnlyPortalOwner();
    }

    /**
     * @inheritdoc AbstractPortal
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

    /**
     * @notice Withdraw funds from the Portal
     * @param to the address to send the funds to
     * @param amount the amount to withdraw
     * @dev Only the owner can withdraw funds
     */
    function withdraw(address payable to, uint256 amount) external override onlyOwner {
        (bool success,) = to.call{value: amount}("");
        if (!success) revert WithdrawFail();
    }

    function verifySignature(bytes memory signature, string memory guildId, address subject) internal view returns (bool) {
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(keccak256("Discord(string id,address subject)"), keccak256(bytes(guildId)), subject))
        );
        address signer = ECDSA.recover(digest, signature);
        return signer == SIGNER_ADDRESS;
    }
}
