// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AdvxRegistry
/// @notice ERC-8004-style trustless agent identity registry + decorative item NFTs
///         for《Advx 极速版 / ADVX TURBO》on Injective EVM.
///         Minimal ERC-721-compatible surface (ownerOf/balanceOf/tokenURI/Transfer).
///         The game relayer (owner) pays gas and mints directly to player wallets,
///         so every identity & item lands in the player's own wallet.
contract AdvxRegistry {
    string public constant name = "Advx Turbo Registry";
    string public constant symbol = "ADVX";
    address public owner;
    uint256 public nextId = 1;

    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => string) public tokenURI;
    /// ERC-8004 identity registry: tokenId <-> agent hash (keccak of worker id)
    mapping(uint256 => bytes32) public agentHashOf;
    mapping(bytes32 => uint256) public agentTokenOf;
    /// 1 = agent identity, 2 = decorative store item
    mapping(uint256 => uint8) public kindOf;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event AgentRegistered(uint256 indexed tokenId, address indexed agentOwner, bytes32 agentHash, string uri);
    event ItemMinted(uint256 indexed tokenId, address indexed to, string uri);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }

    constructor() { owner = msg.sender; }

    function _mint(address to, string memory uri, uint8 kind) internal returns (uint256 id) {
        require(to != address(0), "zero addr");
        id = nextId++;
        ownerOf[id] = to;
        balanceOf[to] += 1;
        tokenURI[id] = uri;
        kindOf[id] = kind;
        emit Transfer(address(0), to, id);
    }

    /// @notice Register an agent identity NFT (ERC-8004 style) to its controller wallet.
    function registerAgent(address agentOwner, bytes32 agentHash, string calldata uri) external onlyOwner returns (uint256 id) {
        require(agentTokenOf[agentHash] == 0, "already registered");
        id = _mint(agentOwner, uri, 1);
        agentHashOf[id] = agentHash;
        agentTokenOf[agentHash] = id;
        emit AgentRegistered(id, agentOwner, agentHash, uri);
    }

    /// @notice Mint a decorative store item NFT to a player wallet.
    function mintItem(address to, string calldata uri) external onlyOwner returns (uint256 id) {
        id = _mint(to, uri, 2);
        emit ItemMinted(id, to, uri);
    }

    /// @notice Basic transfer so players truly own their assets.
    function transferFrom(address from, address to, uint256 tokenId) external {
        require(ownerOf[tokenId] == from && msg.sender == from, "not authorized");
        require(to != address(0), "zero addr");
        ownerOf[tokenId] = to;
        balanceOf[from] -= 1;
        balanceOf[to] += 1;
        emit Transfer(from, to, tokenId);
    }
}
