// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import {AttestationPayload, Portal} from "@verax-attestation-registry/verax-contracts/contracts/types/Structs.sol";
import {OperationType} from "@verax-attestation-registry/verax-contracts/contracts/types/Enums.sol";

/// @dev Local EVM doubles for exercising DiscordPortal through its public entry points.
contract PortalTestRouter {
    address public attestationRegistry;
    address public moduleRegistry;
    address public portalRegistry;

    constructor(address attestationRegistry_, address moduleRegistry_, address portalRegistry_) {
        attestationRegistry = attestationRegistry_;
        moduleRegistry = moduleRegistry_;
        portalRegistry = portalRegistry_;
    }

    function getAttestationRegistry() external view returns (address) {
        return attestationRegistry;
    }

    function getModuleRegistry() external view returns (address) {
        return moduleRegistry;
    }

    function getPortalRegistry() external view returns (address) {
        return portalRegistry;
    }

    function getSchemaRegistry() external pure returns (address) {
        return address(0);
    }
}

contract PortalTestModuleRegistry {
    function runModulesV2(
        address[] calldata,
        AttestationPayload calldata,
        bytes[] calldata,
        uint256,
        address,
        address,
        OperationType
    ) external pure {}
}

contract PortalTestAttestationRegistry {
    bytes32 public lastSchemaId;
    bytes public lastSubject;
    bytes public lastData;
    uint64 public lastExpirationDate;
    address public lastAttester;
    uint256 public attestCount;

    function attest(AttestationPayload calldata payload, address attester) external {
        lastSchemaId = payload.schemaId;
        lastSubject = payload.subject;
        lastData = payload.attestationData;
        lastExpirationDate = payload.expirationDate;
        lastAttester = attester;
        attestCount += 1;
    }
}

contract PortalTestRegistry {
    address public owner;

    constructor(address owner_) {
        owner = owner_;
    }

    function getPortalOwner(address) external view returns (address) {
        return owner;
    }

    function getPortalByAddress(address id) external view returns (Portal memory) {
        return Portal(id, owner, new address[](0), true, "test", "", "test owner");
    }
}
