import React, { useState } from "react";
import { ethers } from "ethers";
import contractABI from "./ValueCentricABI.json";
import axios from "axios";

const CONTRACT_ADDRESS = "0xb5D45863eBDECbD4305e04e7674F684a08A1CAac";
const PINATA_API_KEY = "f7415f07fdfc68176fab";
const PINATA_SECRET_API_KEY = "3712b48777ed913d1183a81624f75b0ab2cac82fa48f575c4b29c4d5d88782e7";

function App() {
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [status, setStatus] = useState("Idle");

  const [productId, setProductId] = useState("");
  const [serial, setSerial] = useState("");
  const [receiver, setReceiver] = useState("");
  const [file, setFile] = useState(null);

  const [fetchProductId, setFetchProductId] = useState("");
  const [fetchSerial, setFetchSerial] = useState("");
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState("");

  // ---------------- MetaMask ----------------
  async function connectWallet() {
    try {
      setStatus("🔗 Connecting to MetaMask...");
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        const addr = await signer.getAddress();

        setAccount(addr);
        const c = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);
        setContract(c);
        setStatus("✅ Wallet Connected");
      } else {
        setError("Install MetaMask first!");
        setStatus("❌ MetaMask not detected");
      }
    } catch (err) {
      setStatus("❌ Failed to connect wallet");
      setError(err.message);
    }
  }

  // ---------------- Product ----------------
  async function registerProduct() {
    try {
      setStatus("🧾 Registering product...");
      const tx = await contract.registerProduct(productId, serial);
      await tx.wait();
      setError("");
      setStatus("✅ Product Registered Successfully!");
    } catch (err) {
      console.error(err);
      setError(err.reason || "Register failed");
      setStatus("❌ Registration Failed");
    }
  }

  async function transferProduct() {
    try {
      setStatus("🚚 Transferring product...");
      const tx = await contract.transferProduct(productId, serial, receiver);
      await tx.wait();
      setError("");
      setStatus("✅ Product Transferred Successfully!");
    } catch (err) {
      console.error(err);
      setError(err.reason || "Transfer failed");
      setStatus("❌ Transfer Failed");
    }
  }

  // ---------------- Document Upload ----------------
  const [uploadedCid, setUploadedCid] = useState(""); // add at top

async function uploadDocument() {
  if (!productId || !serial) {
    setError("⚠️ Enter both Product ID and Serial Number!");
    return;
  }

  if (!file) {
    setError("⚠️ Select a file first!");
    return;
  }

  try {
    setStatus("📤 Uploading document to IPFS...");
    const formData = new FormData();
    formData.append("file", file);

    const res = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_API_KEY,
        },
      }
    );

    const cid = res.data.IpfsHash;
    setUploadedCid(cid); // save CID to state

    const key = ethers.keccak256(
      ethers.toUtf8Bytes(productId + "|" + serial)
    );

    setStatus("🔗 Recording document on blockchain...");
    const tx = await contract.recordDocument(
      key,
      cid,
      ethers.keccak256(ethers.toUtf8Bytes(cid))
    );
    await tx.wait();

    setError("");
    setStatus("✅ Document Uploaded Successfully!");
    alert("📄 Document Uploaded! CID: " + cid);
  } catch (err) {
    console.error(err);
    setError(err.reason || "❌ Upload failed");
    setStatus("❌ Document Upload Failed");
  }
}


  // ---------------- Document Fetch ----------------
  async function fetchDocuments() {
    try {
      setStatus("🔍 Fetching documents...");
      const key = ethers.keccak256(
        ethers.toUtf8Bytes(fetchProductId + "|" + fetchSerial)
      );

      const count = await contract.getDocCount(key);
      const docs = [];
      for (let i = 0; i < count; i++) {
        const doc = await contract.getDocByIndex(key, i);
        docs.push({
          cid: doc[0],
          cidHash: doc[1],
          uploader: doc[2],
          timestamp: Number(doc[3]),
        });
      }
      setDocs(docs);
      setError("");
      setStatus(`✅ Found ${docs.length} Document(s)`);
    } catch (err) {
      console.error(err);
      setError(err.reason || err.message || "Fetch failed");
      setStatus("❌ Failed to fetch documents");
    }
  }

  // ---------------- Styles ----------------
  const cardStyle = {
    backdropFilter: "blur(12px)",
    background: "rgba(255, 255, 255, 0.15)",
    padding: "25px",
    margin: "25px auto",
    width: "90%",
    maxWidth: "480px",
    borderRadius: "16px",
    boxShadow: "0 4px 25px rgba(0, 0, 0, 0.2)",
    color: "#fff",
    textAlign: "center",
    transition: "all 0.3s ease-in-out",
  };

  const inputStyle = {
    padding: "10px",
    margin: "8px",
    borderRadius: "8px",
    border: "none",
    width: "85%",
    maxWidth: "350px",
    outline: "none",
    background: "rgba(255,255,255,0.2)",
    color: "#fff",
  };

  const buttonStyle = {
    background: "linear-gradient(90deg, #0072ff, #00c6ff)",
    color: "white",
    border: "none",
    padding: "10px 20px",
    margin: "10px",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "bold",
    transition: "0.3s",
  };

  const statusBox = {
    background: "rgba(255,255,255,0.2)",
    color: "#fff",
    padding: "15px",
    borderRadius: "10px",
    width: "80%",
    maxWidth: "500px",
    margin: "30px auto",
    textAlign: "center",
    fontWeight: "bold",
    letterSpacing: "0.5px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
  };

  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px 20px",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <h1 style={{ color: "white", fontSize: "2.5rem", marginBottom: "10px" }}>
        ValueCentric Supply Chain DApp
      </h1>
      <p style={{ color: "#e0e0e0", marginBottom: "25px" }}>
        Secure • Transparent • Decentralized
      </p>

      <button style={buttonStyle} onClick={connectWallet}>
        🔗 Connect MetaMask
      </button>
      <p style={{ color: "white" }}>
        <b>Connected Account:</b> {account || "Not connected"}
      </p>
      {error && <p style={{ color: "#ffb3b3" }}>{error}</p>}

      {/* Register */}
      <div style={cardStyle}>
        <h2>🧾 Register Product</h2>
        <input
          style={inputStyle}
          type="text"
          placeholder="Product ID"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        />
        <input
          style={inputStyle}
          type="text"
          placeholder="Serial"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
        />
        <button style={buttonStyle} onClick={registerProduct}>
          Register
        </button>
      </div>

      {/* Transfer */}
      <div style={cardStyle}>
        <h2>🚚 Transfer Product</h2>
        <input
          style={inputStyle}
          type="text"
          placeholder="Product ID"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        />
        <input
          style={inputStyle}
          type="text"
          placeholder="Serial"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
        />
        <input
          style={inputStyle}
          type="text"
          placeholder="Receiver Address"
          value={receiver}
          onChange={(e) => setReceiver(e.target.value)}
        />
        <button style={buttonStyle} onClick={transferProduct}>
          Transfer
        </button>
        
      </div>

      {/* Upload */}
      <div style={cardStyle}>
  <h2>📤 Upload Document</h2>

  <input
    style={inputStyle}
    type="text"
    placeholder="Product ID"
    value={productId}
    onChange={(e) => setProductId(e.target.value)}
  />

  <input
    style={inputStyle}
    type="text"
    placeholder="Serial"
    value={serial}
    onChange={(e) => setSerial(e.target.value)}
  />

  <input
    style={inputStyle}
    type="file"
    onChange={(e) => setFile(e.target.files[0])}
  />

  <button style={buttonStyle} onClick={uploadDocument}>
    Upload
  </button>
</div>



      {/* Fetch */}
      <div style={cardStyle}>
        <h2>📑 Fetch Documents</h2>
        <input
          style={inputStyle}
          type="text"
          placeholder="Product ID"
          value={fetchProductId}
          onChange={(e) => setFetchProductId(e.target.value)}
        />
        <input
          style={inputStyle}
          type="text"
          placeholder="Serial"
          value={fetchSerial}
          onChange={(e) => setFetchSerial(e.target.value)}
        />
        <button style={buttonStyle} onClick={fetchDocuments}>
          Fetch
        </button>

        {docs.length > 0 && (
          <div style={{ marginTop: "20px" }}>
            <h3>📄 Documents Found:</h3>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {docs.map((doc, i) => (
                <li
                  key={i}
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    margin: "10px auto",
                    padding: "12px",
                    borderRadius: "10px",
                    width: "90%",
                    color: "#fff",
                  }}
                >
                  <p><b>Uploader:</b> {doc.uploader}</p>
                  <p>
                    <b>Time:</b>{" "}
                    {new Date(Number(doc.timestamp) * 1000).toLocaleString()}
                  </p>
                  <a
  href={`https://maroon-important-prawn-698.mypinata.cloud/ipfs/${doc.cid}`}
  target="_blank"
  rel="noreferrer"
>
  🔗 View Document
</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Status Panel */}
      <div style={statusBox}>
        <p>{status}</p>
      </div>
    </div>
  );
}

export default App;
