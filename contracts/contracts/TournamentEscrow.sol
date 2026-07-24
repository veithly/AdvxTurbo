// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AccessRoles.sol";

/// @title TournamentEscrow — 赛事奖金托管、结果、领取 (PRD 35 / 42.4)
/// @notice 奖金进入合约托管；结果 + 挑战期后，凭 payout Merkle proof 领取，防重复。
contract TournamentEscrow is AccessRoles {
    enum Status { Registration, RosterLocked, Running, ChallengePeriod, Finalized, Cancelled }

    struct Tournament {
        bytes32 rulesetHash;
        address rewardToken; // address(0) = native INJ
        uint256 prizePool;
        uint64 registrationClose;
        uint64 rosterLock;
        uint64 startTime;
        uint64 challengeEnd;
        uint64 claimDeadline;
        bytes32 resultRoot;
        bytes32 payoutRoot;
        Status status;
        address organizer;
    }

    uint256 public nextId = 1;
    mapping(uint256 => Tournament) public tournaments;
    mapping(uint256 => uint256) public escrowBalance;
    mapping(uint256 => mapping(bytes32 => bool)) public claimed; // tournamentId => leaf => claimed

    event TournamentCreated(uint256 indexed id, address organizer, bytes32 rulesetHash, uint256 prizePool);
    event Funded(uint256 indexed id, uint256 amount, uint256 total);
    event ResultsSubmitted(uint256 indexed id, bytes32 resultRoot, bytes32 payoutRoot, uint64 challengeEnd);
    event RewardClaimed(uint256 indexed id, address indexed recipient, uint256 amount);
    event TournamentCancelled(uint256 indexed id);

    constructor(address admin) AccessRoles(admin) {
        _grantRole(TOURNAMENT_OPERATOR, admin);
    }

    function createTournament(
        bytes32 rulesetHash,
        address rewardToken,
        uint64 registrationClose,
        uint64 rosterLock,
        uint64 startTime,
        uint64 challengePeriodSeconds,
        uint64 claimPeriodSeconds
    ) external whenNotPaused returns (uint256 id) {
        id = nextId++;
        Tournament storage t = tournaments[id];
        t.rulesetHash = rulesetHash;
        t.rewardToken = rewardToken;
        t.registrationClose = registrationClose;
        t.rosterLock = rosterLock;
        t.startTime = startTime;
        t.challengeEnd = uint64(startTime + challengePeriodSeconds);
        t.claimDeadline = uint64(startTime + challengePeriodSeconds + claimPeriodSeconds);
        t.status = Status.Registration;
        t.organizer = msg.sender;
        emit TournamentCreated(id, msg.sender, rulesetHash, 0);
    }

    /// @notice 赞助方注资 (原生 INJ)。ERC20 版本需 REWARD_FUNDER + transferFrom。
    function fundNative(uint256 id) external payable {
        Tournament storage t = tournaments[id];
        require(t.organizer != address(0), "NO_TOURNAMENT");
        require(t.rewardToken == address(0), "NOT_NATIVE");
        escrowBalance[id] += msg.value;
        t.prizePool += msg.value;
        emit Funded(id, msg.value, escrowBalance[id]);
    }

    /// @notice 提交结果与奖金分配 Root，进入挑战期 (PRD 35 / 33.2)
    function submitResults(uint256 id, bytes32 resultRoot, bytes32 payoutRoot) external onlyRole(TOURNAMENT_OPERATOR) {
        Tournament storage t = tournaments[id];
        require(t.status == Status.Registration || t.status == Status.Running || t.status == Status.RosterLocked, "BAD_STATUS");
        t.resultRoot = resultRoot;
        t.payoutRoot = payoutRoot;
        t.status = Status.ChallengePeriod;
        emit ResultsSubmitted(id, resultRoot, payoutRoot, t.challengeEnd);
    }

    /// @notice 挑战期后领取。leaf = keccak256(abi.encode(recipient, amount))
    function claim(uint256 id, uint256 amount, bytes32[] calldata proof) external whenNotPaused {
        Tournament storage t = tournaments[id];
        require(t.status == Status.ChallengePeriod || t.status == Status.Finalized, "NOT_CLAIMABLE");
        require(block.timestamp >= t.challengeEnd, "CHALLENGE_ACTIVE");
        require(block.timestamp <= t.claimDeadline, "CLAIM_CLOSED");
        bytes32 leaf = keccak256(abi.encode(msg.sender, amount));
        require(!claimed[id][leaf], "ALREADY_CLAIMED");
        require(MerkleProof.verify(proof, t.payoutRoot, leaf), "BAD_PROOF");
        require(escrowBalance[id] >= amount, "INSUFFICIENT_ESCROW");
        claimed[id][leaf] = true;
        escrowBalance[id] -= amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "TRANSFER_FAILED");
        emit RewardClaimed(id, msg.sender, amount);
    }

    function finalize(uint256 id) external onlyRole(TOURNAMENT_OPERATOR) {
        tournaments[id].status = Status.Finalized;
    }

    function cancel(uint256 id) external onlyRole(DEFAULT_ADMIN_ROLE) {
        tournaments[id].status = Status.Cancelled;
        emit TournamentCancelled(id);
    }
}
