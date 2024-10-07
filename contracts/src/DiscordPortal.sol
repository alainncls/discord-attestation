// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AbstractPortal} from "@verax-attestation-registry/verax-contracts/contracts/abstracts/AbstractPortal.sol";
import {AttestationPayload} from "@verax-attestation-registry/verax-contracts/contracts/types/Structs.sol";

/**
 * @title eFrogs Portal
 * @author alainnicolas.eth
 * @notice This contract aims to attest of the presence in a Discord server
 */
contract DiscordPortal is AbstractPortal, Ownable {
    uint256 public fee;

    /// @dev Error thrown when the Schema used is not the expected one
    error InvalidSchema();
    /// @dev Error thrown when the attestation subject is not an Ethereum address
    error InvalidSubject();
    /// @dev Error thrown when the attestation subject is not the sender
    error SenderIsNotSubject();
    /// @dev Error thrown when the attestation subject doesn't own an eFrog
    error SenderIsNotOwner();
    /// @dev Error thrown when the transaction value is insufficient to cover the fee
    error InsufficientFee();
    /// @dev Error thrown when the withdraw fails
    error WithdrawFail();
    /// @dev Error thrown when the subject signature is invalid
    error InvalidSubjectSignature();
    /// @dev Error thrown when the guildId signature is invalid
    error InvalidGuildIdSignature();
    /// @dev Error thrown when the signature length is invalid
    error InvalidSignatureLength();

    constructor(address[] memory modules, address router) AbstractPortal(modules, router) {
        fee = 0.0001 ether;
    }

    /**
     * @notice Run before the payload is attested
     * @param attestationPayload the attestation payload to be attested
     * @param value the value sent with the attestation
     * @dev This function checks if
     *          the sender is the subject of the attestation
     *          and if the value sent is sufficient
     */
    function _onAttestV2(
        AttestationPayload memory attestationPayload,
        bytes[] memory validationPayloads,
        uint256 value
    ) internal view override {
        address subject;
        if (attestationPayload.subject.length == 32) {
            subject = abi.decode(attestationPayload.subject, (address));
        } else if (attestationPayload.subject.length == 20) {
            subject = address(uint160(bytes20(attestationPayload.subject)));
        } else {
            revert InvalidSubject();
        }

        if (subject != msg.sender) revert SenderIsNotSubject();
        if (value < fee) revert InsufficientFee();
        if (attestationPayload.schemaId != 0xa8d6aefe759739c13a4151523a525bfe88b7dae97bdd5de50dab89cb247690d4)
            revert InvalidSchema();

        bytes32 subjectHash = keccak256(abi.encodePacked(subject));
        bytes32 guildIdHash = keccak256(abi.encodePacked(abi.decode(attestationPayload.attestationData, (string))));

        (bytes32 r, bytes32 s, uint8 v) = splitSignature(validationPayloads[0]);
        address signer = ecrecover(subjectHash, v, r, s);
        if (signer != 0x8029dD56C10a9C2Dd8969a645d297b4636Aaf494) revert InvalidSubjectSignature();

        (r, s, v) = splitSignature(validationPayloads[1]);
        signer = ecrecover(guildIdHash, v, r, s);
        if (signer != 0x8029dD56C10a9C2Dd8969a645d297b4636Aaf494) revert InvalidGuildIdSignature();
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
        (bool s, ) = to.call{value: amount}("");
        if (!s) revert WithdrawFail();
    }

    function splitSignature(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        if (sig.length != 65) revert InvalidSignatureLength();

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        return (r, s, v);
    }
}
