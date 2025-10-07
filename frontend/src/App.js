import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import ABI from "./ValueCentricABI.json";

const CONTRACT_ADDRESS = "0xb5D45863eBDECbD4305e04e7674F684a08A1CAac";
const PINATA_API_KEY = "f7415f07fdfc68176fab";
const PINATA_SECRET_KEY = "3712b48777ed913d1183a81624f75b0ab2cac82fa48f575c4b29c4d5d88782e7";

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [productId, setProductId] = useState("");
  const [serial, setSerial] = useState("");
  const [receiver, setReceiver] = useState("");
  const [docs, setDocs] = useState([]);
  const [status, setStatus] = useState({ msg: "", type: "" });

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        } else {
          setAccount(null);
        }
      });
    }
  }, []);

  async function connectWallet() {
    if (!window.ethereum) return alert("Install MetaMask");
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const addr = await signer.getAddress();
    setAccount(addr);
    const c = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    setContract(c);
  }

  function showStatus(msg, type = "info") {
    setStatus({ msg, type });
  }

  async function registerProduct() {
    try {
      showStatus("⏳ Registering product...");
      const tx = await contract.registerProduct(productId, serial);
      await tx.wait();
      showStatus("✅ Product registered successfully!", "success");
    } catch (e) {
      console.error(e);
      showStatus("❌ Register failed: " + (e.data?.message || e.message), "error");
    }
  }

  async function transferProduct() {
    try {
      showStatus("⏳ Transferring product...");
      const tx = await contract.transferProduct(productId, serial, receiver);
      await tx.wait();
      showStatus("✅ Product transferred successfully!", "success");
    } catch (e) {
      console.error(e);
      showStatus("❌ Transfer failed: " + (e.data?.message || e.message), "error");
    }
  }

  async function recordDocument(file) {
    try {
      showStatus("⏳ Uploading file to Pinata...");
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
        body: formData,
      });

      const r = await res.json();
      const cid = r.IpfsHash;
      if (!cid) throw new Error("Pinata upload failed");

      showStatus("📦 Uploaded to Pinata: " + cid + ". Recording on chain...");

      const key = await contract.computeProductKey(productId, serial);
      const docHash = ethers.keccak256(ethers.toUtf8Bytes(file.name));

      const tx = await contract.recordDocument(key, cid, docHash);
      await tx.wait();
      showStatus("✅ Document recorded on blockchain!", "success");
    } catch (e) {
      console.error(e);
      showStatus("❌ Upload/record failed: " + (e.data?.message || e.message), "error");
    }
  }

  async function fetchDocs() {
    try {
      const key = await contract.computeProductKey(productId, serial);
      const count = await contract.getDocCount(key);
      const n = Number(count);
      const fetched = [];
      for (let i = 0; i < n; i++) {
        const doc = await contract.getDocByIndex(key, i);
        fetched.push({
          cid: doc[0],
          uploader: doc[2],
          timestamp: new Date(Number(doc[3]) * 1000).toLocaleString(),
        });
      }
      setDocs(fetched);
      showStatus("📄 Loaded " + fetched.length + " documents", "success");
    } catch (e) {
      console.error(e);
      showStatus("❌ Fetch failed: " + (e.data?.message || e.message), "error");
    }
  }

  const cardStyle = {
    background: "#fff",
    padding: "20px",
    marginBottom: "20px",
    borderRadius: "10px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  };

  const buttonStyle = (color) => ({
    padding: "10px 15px",
    marginTop: "10px",
    background: color,
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  });

  const statusColor = {
    info: "#2980b9",
    success: "#27ae60",
    error: "#c0392b",
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", fontFamily: "Segoe UI, sans-serif", padding: "20px" }}>
      <h1 style={{ textAlign: "center", color: "#2c3e50" }}>ValueCentric Supply Chain DApp</h1>
      <p style={{ textAlign: "center", color: "#555" }}>
        Blockchain + IPFS-powered traceability with role-based access control
      </p>

      {!account ? (
        <div style={{ textAlign: "center", margin: "20px" }}>
          <button onClick={connectWallet} style={buttonStyle("#1f6feb")}>
            🔗 Connect MetaMask
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center", margin: "10px", color: "#16a085" }}>
          ✅ Connected: <b>{account}</b>
        </div>
      )}

      {/* Register Product */}
      <div style={cardStyle}>
        <h2>📦 Register Product</h2>
        <label>Product ID:</label>
        <input
          type="text"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          style={{ width: "100%", padding: "8px", margin: "5px 0" }}
        />
        <label>Serial Number:</label>
        <input
          type="text"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          style={{ width: "100%", padding: "8px", margin: "5px 0" }}
        />
        <button onClick={registerProduct} style={buttonStyle("#27ae60")}>
          ✅ Register
        </button>
      </div>

      {/* Transfer Product */}
<div style={cardStyle}>
  <h2>🔄 Transfer Product</h2>
  
  <label>Product ID:</label>
  <input
    type="text"
    value={productId}
    onChange={(e) => setProductId(e.target.value)}
    style={{ width: "100%", padding: "8px", margin: "5px 0" }}
    placeholder="Enter product ID"
  />

  <label>Serial Number:</label>
  <input
    type="text"
    value={serial}
    onChange={(e) => setSerial(e.target.value)}
    style={{ width: "100%", padding: "8px", margin: "5px 0" }}
    placeholder="Enter serial number"
  />

  <label>Receiver Address:</label>
  <input
    type="text"
    value={receiver}
    onChange={(e) => setReceiver(e.target.value)}
    style={{ width: "100%", padding: "8px", margin: "5px 0" }}
    placeholder="Enter receiver wallet address"
  />

  <button onClick={transferProduct} style={buttonStyle("#f39c12")}>
    🔄 Transfer
  </button>
</div>


      {/* Upload Document */}
      <div style={cardStyle}>
        <h2>📑 Upload Certificate</h2>
        <input type="file" onChange={(e) => recordDocument(e.target.files[0])} />
      </div>

      {/* Fetch Documents */}
      <div style={cardStyle}>
        <h2>📄 View Documents</h2>
        <button onClick={fetchDocs} style={buttonStyle("#8e44ad")}>
          🔍 Fetch Docs
        </button>
        <ul>
          {docs.map((d, i) => (
            <li key={i} style={{ margin: "8px 0" }}>
              <a href={`https://gateway.pinata.cloud/ipfs/${d.cid}`} target="_blank" rel="noreferrer">
                {d.cid}
              </a>{" "}
              <br />
              Uploaded by: {d.uploader} <br />
              On: {d.timestamp}
            </li>
          ))}
        </ul>
      </div>

      {/* Status */}
      {status.msg && (
        <div
          style={{
            marginTop: "20px",
            padding: "12px",
            borderRadius: "6px",
            background: statusColor[status.type] || "#2980b9",
            color: "#fff",
            textAlign: "center",
          }}
        >
          {status.msg}
        </div>
      )}
    </div>
  );
}

export default App;
