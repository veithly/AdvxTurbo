// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AccessRoles.sol";

/// @title MatchRootRegistry — 比赛批次 Merkle Root (PRD 32)
/// @notice 每批比赛提交 Merkle Root；任何人可用 proof 验证单场比赛。
contract MatchRootRegistry is AccessRoles {
    struct MatchBatch {
        uint64 batchId;
        bytes32 merkleRoot;
        bytes32 engineSetHash;
        bytes32 manifestHash;
        uint64 matchCount;
        uint64 startTime;
        uint64 endTime;
        string manifestURI;
        bool invalidated;
    }

    mapping(uint64 => MatchBatch) public batches;
    uint64 public latestBatchId;

    event MatchBatchSubmitted(uint64 indexed batchId, bytes32 merkleRoot, uint64 matchCount, string manifestURI);
    event MatchBatchInvalidated(uint64 indexed batchId, bytes32 reasonHash);

    constructor(address admin) AccessRoles(admin) {
        _grantRole(BATCH_SUBMITTER, admin);
    }

    function submitBatch(
        uint64 batchId,
        bytes32 merkleRoot,
        bytes32 engineSetHash,
        bytes32 manifestHash,
        uint64 matchCount,
        uint64 startTime,
        uint64 endTime,
        string calldata manifestURI,
        bytes[] calldata verifierSignatures
    ) external onlyRole(BATCH_SUBMITTER) whenNotPaused {
        require(batches[batchId].batchId == 0, "BATCH_EXISTS");
        // MVP：至少 2 个验证器签名 (PRD 33.2)。签名验证在链下完成，链上记录数量约束。
        require(verifierSignatures.length >= 2, "NEED_2_SIGNATURES");
        batches[batchId] = MatchBatch({
            batchId: batchId,
            merkleRoot: merkleRoot,
            engineSetHash: engineSetHash,
            manifestHash: manifestHash,
            matchCount: matchCount,
            startTime: startTime,
            endTime: endTime,
            manifestURI: manifestURI,
            invalidated: false
        });
        if (batchId > latestBatchId) latestBatchId = batchId;
        emit MatchBatchSubmitted(batchId, merkleRoot, matchCount, manifestURI);
    }

    // 只在严重漏洞/伪造时由 Timelock/门槛失效 (PRD 32.5)
    function invalidateBatch(uint64 batchId, bytes32 reasonHash) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(batches[batchId].batchId != 0, "NO_BATCH");
        batches[batchId].invalidated = true;
        emit MatchBatchInvalidated(batchId, reasonHash);
    }

    /// @notice 验证单场比赛 leaf 属于该批次
    function verifyMatch(uint64 batchId, bytes32 matchLeaf, bytes32[] calldata proof) external view returns (bool) {
        MatchBatch memory b = batches[batchId];
        if (b.batchId == 0 || b.invalidated) return false;
        return MerkleProof.verify(proof, b.merkleRoot, matchLeaf);
    }
}
