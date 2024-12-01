import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import "./App.css"; // Import CSS file

interface WalletInfo {
  address: string;
  balance: string;
  chainId: number;
  chainName: string;
}

const App: React.FC = () => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch wallet info
  const fetchWalletInfo = async (accounts: string[]) => {
    if (accounts.length === 0) {
      setWallet(null);
      setError("No accounts found. Please connect your wallet.");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const account = accounts[0]; // Use the first account
      const balance = ethers.formatEther(await provider.getBalance(account)); // Get balance
      const network = await provider.getNetwork(); // Get network details

      setWallet({
        address: account,
        balance,
        chainId: network.chainId,
        chainName: network.name || "Unknown Network",
      });
      setError(null); // Clear any previous errors
    } catch (err: any) {
      setError(err.message || "Failed to fetch wallet info");
    }
  };

  // Connect wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      setError("MetaMask is not installed!");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []); // Request account access
      fetchWalletInfo(accounts); // Fetch wallet info
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
    }
  };

  // Handle wallet/account changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      fetchWalletInfo(accounts); // Update wallet info when account changes
    };

    const handleChainChanged = () => {
      // Reload the page to update the network
      window.location.reload();
    };

    // Listen for account changes and chain changes
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    // Cleanup listeners on component unmount
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  // Disconnect the wallet
  const disconnectWallet = () => {
    setWallet(null); // Reset wallet state
  };

  return (
    <div className="container">
      <h1 className="title">Wallet Connection</h1>
      {error && <p className="error">{error}</p>}

      {wallet ? (
        <div className="wallet-info">
          <p>
            <strong>Wallet Address:</strong> {wallet.address}
          </p>
          <p>
            <strong>Balance:</strong> {wallet.balance} ETH
          </p>
          <button className="btn disconnect-btn" onClick={disconnectWallet}>
            Disconnect Wallet
          </button>
        </div>
      ) : (
        <button className="btn connect-btn" onClick={connectWallet}>
          Connect Wallet
        </button>
      )}
    </div>
  );
};

export default App;
