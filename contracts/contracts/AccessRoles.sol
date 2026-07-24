// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice 轻量级角色权限 (PRD 29.2) — 避免外部依赖，便于源码验证
abstract contract AccessRoles {
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant BATCH_SUBMITTER = keccak256("BATCH_SUBMITTER");
    bytes32 public constant VERIFIER_MANAGER = keccak256("VERIFIER_MANAGER");
    bytes32 public constant TOURNAMENT_OPERATOR = keccak256("TOURNAMENT_OPERATOR");
    bytes32 public constant REWARD_FUNDER = keccak256("REWARD_FUNDER");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    mapping(bytes32 => mapping(address => bool)) private _roles;
    bool public paused;

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);
    event Paused(address account);
    event Unpaused(address account);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    modifier onlyRole(bytes32 role) {
        require(_roles[role][msg.sender], "ACCESS_DENIED");
        _;
    }
    modifier whenNotPaused() {
        require(!paused, "PAUSED");
        _;
    }

    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }

    function grantRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _roles[role][account] = false;
        emit RoleRevoked(role, account, msg.sender);
    }

    function _grantRole(bytes32 role, address account) internal {
        _roles[role][account] = true;
        emit RoleGranted(role, account, msg.sender);
    }

    // PRD 43.3 紧急暂停
    function pause() external onlyRole(PAUSER_ROLE) {
        paused = true;
        emit Paused(msg.sender);
    }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        paused = false;
        emit Unpaused(msg.sender);
    }
}

/// @notice OZ 风格 sorted-pair keccak Merkle 证明 (PRD 32.3)
library MerkleProof {
    function verify(bytes32[] memory proof, bytes32 root, bytes32 leaf) internal pure returns (bool) {
        bytes32 h = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            h = h <= p ? keccak256(abi.encodePacked(h, p)) : keccak256(abi.encodePacked(p, h));
        }
        return h == root;
    }
}
