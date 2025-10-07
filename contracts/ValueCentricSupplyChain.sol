// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ValueCentricSupplyChain {
    // Roles
    enum Role { None, Manufacturer, Distributor, Pharmacy, Auditor }


    struct Product {
        bytes32 productKey;
        string productId;
        string serial;
        address currentOwner;
        address[] history;
        bool exists;
    }

    
    struct DocRecord {
        string cid;       // IPFS CID
        bytes32 cidHash;  // keccak256 of file (optional)
        address uploader;
        uint256 timestamp;
    }

    address public admin;

    // storage
    mapping(address => Role) public roles;
    mapping(bytes32 => Product) public products;
    mapping(bytes32 => DocRecord[]) private productDocs;
    mapping(bytes32 => mapping(address => bool)) public productViewers;
    mapping(bytes32 => mapping(address => bytes)) private encKeys;

    // events
    event ProductRegistered(bytes32 indexed productKey, string productId, string serial, address indexed manufacturer);
    event ProductTransferred(bytes32 indexed productKey, address indexed from, address indexed to);
    event DocumentRecorded(bytes32 indexed productKey, string cid, address indexed uploader);
    event EncryptedKeyStored(bytes32 indexed productKey, address indexed recipient);
    event RoleAssigned(address indexed user, Role role);
    event RoleRevoked(address indexed user);

    // modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    modifier onlyRole(Role r) {
        require(roles[msg.sender] == r, "Not authorized for role");
        _;
    }
    modifier productExists(bytes32 key) {
        require(products[key].exists, "Unknown product");
        _;
    }

    constructor() {
        admin = msg.sender;
        roles[msg.sender] = Role.Auditor; // admin has auditor capabilities
    }

    // ---------------- Role Management ----------------
    function assignRole(address user, Role r) external onlyAdmin {
        require(user != address(0), "Zero address");
        roles[user] = r;
        emit RoleAssigned(user, r);
    }

    function revokeRole(address user) external onlyAdmin {
        roles[user] = Role.None;
        emit RoleRevoked(user);
    }

    // ---------------- Product Lifecycle ----------------
    function computeProductKey(string memory productId, string memory serial) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(productId, "|", serial));
    }

    function registerProduct(string calldata productId, string calldata serial) external onlyRole(Role.Manufacturer) {
        require(bytes(productId).length > 0, "Empty productId");
        require(bytes(serial).length > 0, "Empty serial");

        bytes32 key = computeProductKey(productId, serial);
        require(!products[key].exists, "Already exists");

        Product storage p = products[key];
        p.productKey = key;
        p.productId = productId;
        p.serial = serial;
        p.currentOwner = msg.sender;
        p.history.push(msg.sender);
        p.exists = true;

        // viewer: owner + admin
        productViewers[key][msg.sender] = true;
        productViewers[key][admin] = true;

        emit ProductRegistered(key, productId, serial, msg.sender);
    }

    function transferProduct(string calldata productId, string calldata serial, address to) external productExists(computeProductKey(productId, serial)) {
        require(to != address(0), "Invalid recipient");

        bytes32 key = computeProductKey(productId, serial);
        Product storage p = products[key];
        require(p.currentOwner == msg.sender, "Only current owner can transfer");

        address from = p.currentOwner;
        p.currentOwner = to;
        p.history.push(to);

        // auto-grant viewer to recipient so they can view docs
        productViewers[key][to] = true;

        emit ProductTransferred(key, from, to);
    }

    // Read basic product public info (non-sensitive)
    function getProductPublic(bytes32 key) external view productExists(key) returns (
        string memory productId,
        string memory serial,
        address currentOwner,
        uint256 historyLength
    ) {
        Product storage p = products[key];
        return (p.productId, p.serial, p.currentOwner, p.history.length);
    }

    // History access (get one entry)
    function getHistoryByIndex(bytes32 key, uint256 index) external view productExists(key) returns (address) {
        Product storage p = products[key];
        require(index < p.history.length, "History index OOB");
        return p.history[index];
    }

    // ---------------- Viewer Management ----------------
    function grantViewer(bytes32 key, address viewer) external productExists(key) {
        require(msg.sender == products[key].currentOwner || msg.sender == admin, "Not authorized to grant");
        productViewers[key][viewer] = true;
    }
    function revokeViewer(bytes32 key, address viewer) external productExists(key) {
        require(msg.sender == products[key].currentOwner || msg.sender == admin, "Not authorized to revoke");
        productViewers[key][viewer] = false;
    }

    // ---------------- Document Management ----------------
    // Record a document (uploader must be a viewer or owner)
    function recordDocument(bytes32 key, string calldata cid, bytes32 cidHash) external productExists(key) {
        require(productViewers[key][msg.sender] || msg.sender == admin, "Uploader not allowed");

        productDocs[key].push(DocRecord({
            cid: cid,
            cidHash: cidHash,
            uploader: msg.sender,
            timestamp: block.timestamp
        }));

        // ensure uploader can view
        productViewers[key][msg.sender] = true;

        emit DocumentRecorded(key, cid, msg.sender);
    }

    // safer getters for docs (avoid returning huge arrays)
    function getDocCount(bytes32 key) external view productExists(key) returns (uint256) {
        return productDocs[key].length;
    }
    function getDocByIndex(bytes32 key, uint256 index) external view productExists(key) returns (string memory cid, bytes32 cidHash, address uploader, uint256 timestamp) {
        require(productViewers[key][msg.sender] || roles[msg.sender] == Role.Auditor, "Not allowed to read docs");
        DocRecord storage d = productDocs[key][index];
        return (d.cid, d.cidHash, d.uploader, d.timestamp);
    }

    // ---------------- Encryption Key Management ----------------
    // Store encrypted AES key for recipient (uploader must be a viewer)
    function storeEncryptedKey(bytes32 key, address recipient, bytes calldata encKey) external productExists(key) {
        require(productViewers[key][msg.sender] || msg.sender == admin, "Not allowed to store key");
        encKeys[key][recipient] = encKey;
        emit EncryptedKeyStored(key, recipient);
    }

    // Recipient retrieves their encrypted AES key (or admin/auditor can check their own)
    function getEncryptedKey(bytes32 key) external view productExists(key) returns (bytes memory) {
        // admin/auditor may not be allowed to see others' encrypted key; we return only for caller
        bytes memory k = encKeys[key][msg.sender];
        require(k.length > 0, "No key for caller");
        return k;
    }
}
