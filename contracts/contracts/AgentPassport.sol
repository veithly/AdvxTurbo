// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./AccessRoles.sol";

/// @title AgentPassport — 非转让 Agent 身份 SBT (PRD 30)
/// @notice ERC-721 元数据接口 + 禁止普通转让；排名绑定 workerIdHash。
contract AgentPassport is AccessRoles {
    struct PassportData {
        bytes32 workerIdHash;
        bytes32 metadataHash;
        address controller;
        uint64 mintedAt;
        uint64 updatedAt;
        bool frozen;
    }

    string public name = "BLAME GAME Agent Passport";
    string public symbol = "BGAP";

    uint256 private _nextId = 1;
    mapping(uint256 => PassportData) public passports;
    mapping(uint256 => address) private _owners;
    mapping(uint256 => string) private _tokenURIs;
    mapping(bytes32 => uint256) public activePassportOf; // workerIdHash => tokenId
    mapping(address => uint256) public balanceOf;

    // 控制器恢复延迟窗口 (PRD 30.5)
    uint256 public constant RECOVERY_DELAY = 2 days;
    mapping(uint256 => uint256) public recoveryReadyAt;
    mapping(uint256 => address) public pendingController;

    event PassportMinted(uint256 indexed tokenId, address indexed owner, bytes32 workerIdHash, bytes32 metadataHash);
    /// @dev ERC-721 标准 Transfer 事件：钱包/浏览器依赖它索引 NFT（SBT 仅在 mint 时发出）
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event PassportMetadataUpdated(uint256 indexed tokenId, bytes32 metadataHash, string uri);
    event PassportControllerChanged(uint256 indexed tokenId, address oldController, address newController);
    event PassportFrozen(uint256 indexed tokenId, bytes32 reasonHash);
    event PassportUnfrozen(uint256 indexed tokenId);
    event PassportRecovered(uint256 indexed tokenId, address oldController, address newController);

    error NonTransferable();

    constructor(address admin) AccessRoles(admin) {
        _grantRole(REGISTRAR_ROLE, admin);
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address o = _owners[tokenId];
        require(o != address(0), "NO_TOKEN");
        return o;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_owners[tokenId] != address(0), "NO_TOKEN");
        return _tokenURIs[tokenId];
    }

    /// @notice 同一 workerIdHash 只能存在一个活跃 Passport (PRD 30.5 验收)
    function mintPassport(
        address owner,
        bytes32 workerIdHash,
        bytes32 metadataHash,
        string calldata metadataURI
    ) external onlyRole(REGISTRAR_ROLE) whenNotPaused returns (uint256 tokenId) {
        require(owner != address(0), "ZERO_OWNER");
        require(activePassportOf[workerIdHash] == 0, "ALREADY_MINTED");
        tokenId = _nextId++;
        _owners[tokenId] = owner;
        balanceOf[owner] += 1;
        _tokenURIs[tokenId] = metadataURI;
        activePassportOf[workerIdHash] = tokenId;
        passports[tokenId] = PassportData({
            workerIdHash: workerIdHash,
            metadataHash: metadataHash,
            controller: owner,
            mintedAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp),
            frozen: false
        });
        emit PassportMinted(tokenId, owner, workerIdHash, metadataHash);
        emit Transfer(address(0), owner, tokenId);
    }

    // ERC-165：声明 ERC-721 + Metadata 接口，便于钱包/浏览器识别
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f;
    }

    // ERC-721 只读兼容视图（SBT 永远无授权）
    function getApproved(uint256) external pure returns (address) {
        return address(0);
    }
    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function updateMetadata(uint256 tokenId, bytes32 newMetadataHash, string calldata newURI) external {
        PassportData storage p = passports[tokenId];
        require(msg.sender == p.controller || hasRole(REGISTRAR_ROLE, msg.sender), "NOT_CONTROLLER");
        require(!p.frozen, "FROZEN");
        p.metadataHash = newMetadataHash;
        p.updatedAt = uint64(block.timestamp);
        _tokenURIs[tokenId] = newURI;
        emit PassportMetadataUpdated(tokenId, newMetadataHash, newURI);
    }

    function setController(uint256 tokenId, address newController) external {
        PassportData storage p = passports[tokenId];
        require(msg.sender == p.controller, "NOT_CONTROLLER");
        require(newController != address(0), "ZERO");
        address old = p.controller;
        p.controller = newController;
        emit PassportControllerChanged(tokenId, old, newController);
    }

    function freezePassport(uint256 tokenId, bytes32 reasonHash) external onlyRole(REGISTRAR_ROLE) {
        passports[tokenId].frozen = true;
        emit PassportFrozen(tokenId, reasonHash);
    }

    function unfreezePassport(uint256 tokenId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        passports[tokenId].frozen = false;
        emit PassportUnfrozen(tokenId);
    }

    /// @notice 恢复流程带延迟窗口，防止后台单点盗取 (PRD 30.5)
    function requestRecovery(uint256 tokenId, address newController) external onlyRole(REGISTRAR_ROLE) {
        pendingController[tokenId] = newController;
        recoveryReadyAt[tokenId] = block.timestamp + RECOVERY_DELAY;
    }

    function recoverController(uint256 tokenId, address newController, bytes calldata) external onlyRole(REGISTRAR_ROLE) {
        require(pendingController[tokenId] == newController, "NO_PENDING");
        require(block.timestamp >= recoveryReadyAt[tokenId] && recoveryReadyAt[tokenId] != 0, "DELAY");
        address old = passports[tokenId].controller;
        passports[tokenId].controller = newController;
        pendingController[tokenId] = address(0);
        recoveryReadyAt[tokenId] = 0;
        emit PassportRecovered(tokenId, old, newController);
    }

    function isFrozen(uint256 tokenId) external view returns (bool) {
        return passports[tokenId].frozen;
    }

    // 非转让 (PRD 30.3)：所有普通转让路径均 revert
    function transferFrom(address, address, uint256) external pure {
        revert NonTransferable();
    }
    function safeTransferFrom(address, address, uint256) external pure {
        revert NonTransferable();
    }
    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert NonTransferable();
    }
    function approve(address, uint256) external pure {
        revert NonTransferable();
    }
    function setApprovalForAll(address, bool) external pure {
        revert NonTransferable();
    }
}
