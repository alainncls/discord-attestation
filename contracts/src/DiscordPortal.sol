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

    /// @dev Error thrown when the attestation subject is not the sender
    error SenderIsNotSubject();
    /// @dev Error thrown when the attestation subject doesn't own an eFrog
    error SenderIsNotOwner();
    /// @dev Error thrown when the transaction value is insufficient to cover the fee
    error InsufficientFee();
    /// @dev Error thrown when the withdraw fails
    error WithdrawFail();

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
    function _onAttest(
        AttestationPayload memory attestationPayload,
        address /*attester*/,
        uint256 value
    ) internal view override {
        address subject = address(0);

        if (attestationPayload.subject.length == 32) subject = abi.decode(attestationPayload.subject, (address));
        if (attestationPayload.subject.length == 20) subject = address(uint160(bytes20(attestationPayload.subject)));
        if (subject != msg.sender) revert SenderIsNotSubject();
        if (value < fee) revert InsufficientFee();
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
}
