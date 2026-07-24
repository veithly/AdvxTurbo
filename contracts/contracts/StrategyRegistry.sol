// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AccessRoles.sol";

interface IPassport {
    function ownerOf(uint256 tokenId) external view returns (address);
    function isFrozen(uint256 tokenId) external view returns (bool);
    function passports(uint256) external view returns (bytes32, bytes32, address, uint64, uint64, bool);
}

/// @title StrategyRegistry — 策略版本哈希承诺 (PRD 31)
/// @notice 保存版本承诺而不泄露代码；支持谱系与时间证明。
contract StrategyRegistry is AccessRoles {
    struct StrategyCommitment {
        uint256 passportId;
        bytes32 versionHash;
        bytes32 sourceHash;
        bytes32 artifactHash;
        bytes32 parentVersionHash;
        bytes32 compatibilityHash;
        bytes32 metadataHash;
        uint64 registeredAt;
        address registrant;
        bool revoked;
    }

    IPassport public immutable passport;
    mapping(bytes32 => StrategyCommitment) public commitments; // versionHash => commitment
    mapping(uint256 => bytes32[]) public versionsOf; // passportId => versionHashes

    event StrategyVersionRegistered(uint256 indexed passportId, bytes32 indexed versionHash, bytes32 sourceHash, address registrant);
    event StrategyVersionRevoked(bytes32 indexed versionHash, bytes32 reasonHash);

    constructor(address admin, address passportAddr) AccessRoles(admin) {
        passport = IPassport(passportAddr);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    function registerVersion(
        uint256 passportId,
        bytes32 versionHash,
        bytes32 sourceHash,
        bytes32 artifactHash,
        bytes32 parentVersionHash,
        bytes32 compatibilityHash,
        bytes32 metadataHash,
        string calldata metadataURI
    ) external whenNotPaused {
        // controller 或 REGISTRAR 可登记
        (, , address controller, , , bool frozen) = passport.passports(passportId);
        require(msg.sender == controller || hasRole(REGISTRAR_ROLE, msg.sender), "NOT_AUTHORIZED");
        require(!frozen, "PASSPORT_FROZEN"); // 冻结不能登记新策略 (PRD 30.5)
        require(commitments[versionHash].registeredAt == 0, "ALREADY_REGISTERED");
        commitments[versionHash] = StrategyCommitment({
            passportId: passportId,
            versionHash: versionHash,
            sourceHash: sourceHash,
            artifactHash: artifactHash,
            parentVersionHash: parentVersionHash,
            compatibilityHash: compatibilityHash,
            metadataHash: metadataHash,
            registeredAt: uint64(block.timestamp),
            registrant: msg.sender,
            revoked: false
        });
        versionsOf[passportId].push(versionHash);
        // 抑制未使用变量告警
        metadataURI;
        emit StrategyVersionRegistered(passportId, versionHash, sourceHash, msg.sender);
    }

    function revokeVersion(bytes32 versionHash, bytes32 reasonHash) external onlyRole(REGISTRAR_ROLE) {
        commitments[versionHash].revoked = true;
        emit StrategyVersionRevoked(versionHash, reasonHash);
    }

    function isVersionUsable(uint256 passportId, bytes32 versionHash) external view returns (bool) {
        StrategyCommitment memory c = commitments[versionHash];
        return c.registeredAt != 0 && !c.revoked && c.passportId == passportId && !passport.isFrozen(passportId);
    }

    function versionCount(uint256 passportId) external view returns (uint256) {
        return versionsOf[passportId].length;
    }
}
