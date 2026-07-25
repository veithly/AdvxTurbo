// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BlameAnchor
/// @notice On-chain match/result anchor for《抢热点大作战 / CATCH THE HOTSPOT》on Injective EVM.
///         Each ranked match's deterministic replay/result root can be anchored here so anyone
///         can verify the match happened and was not altered after the fact.
contract BlameAnchor {
    address public owner;
    uint256 public matchCount;

    /// root (replayHash/resultHash) => block timestamp it was anchored
    mapping(bytes32 => uint256) public anchoredAt;

    event MatchAnchored(bytes32 indexed root, address indexed by, uint256 matchIndex, uint256 timestamp);

    constructor() {
        owner = msg.sender;
    }

    /// @notice Anchor a match root on-chain. Emits MatchAnchored and returns the running index.
    function anchorMatch(bytes32 root) external returns (uint256) {
        anchoredAt[root] = block.timestamp;
        matchCount += 1;
        emit MatchAnchored(root, msg.sender, matchCount, block.timestamp);
        return matchCount;
    }

    /// @notice Whether a given root has been anchored.
    function isAnchored(bytes32 root) external view returns (bool) {
        return anchoredAt[root] != 0;
    }
}
