import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import axios from "axios";
import "./App.css";

interface WalletInfo {
  address: string;
  balance: string;
  chainName: string;
}

interface TokenInfo {
  name: string;
  symbol: string;
  balance: string;
}

const App: React.FC = () => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const moralisApiKey = import.meta.env.VITE_MORALIS_API_KEY;


  console.log("Moralis API Key:", moralisApiKey);


  // Fetch ERC-20 tokens using Moralis API
  const fetchTokens = async (address: string) => {
    if (!moralisApiKey) {
      setError("Moralis API key is not set.");
      return;
    }

    try {
      const response = await axios.get(
        `https://deep-index.moralis.io/api/v2/${address}/erc20`,
        {
          headers: {
            "X-API-Key": moralisApiKey,
          },
          params: {
            chain: "eth", // Ethereum mainnet
          },
        }
      );

      const tokenData: TokenInfo[] = response.data.map((token: any) => ({
        name: token.name || "Unknown",
        symbol: token.symbol || "N/A",
        balance: (parseFloat(token.balance) / 10 ** token.decimals).toFixed(4), // Adjust balance by decimals
      }));

      setTokens(tokenData);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch tokens");
    }
  };

  // Fetch wallet info
  const fetchWalletInfo = async (accounts: string[]) => {
    if (accounts.length === 0) {
      setWallet(null);
      setError("No accounts found. Please connect your wallet.");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const account = accounts[0];
      const balance = ethers.formatEther(await provider.getBalance(account));
      const network = await provider.getNetwork();

      setWallet({
        address: account,
        balance,
        chainName: network.name || "Unknown Network",
      });

      fetchTokens(account); // Fetch tokens after wallet info
      setError(null);
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
      const accounts = await provider.send("eth_requestAccounts", []);
      fetchWalletInfo(accounts);
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
    }
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

          <h2>Your Tokens:</h2>
          {tokens.length > 0 ? (
            <ul className="token-list">
              {tokens.map((token, index) => (
                <li key={index}>
                  {token.name} ({token.symbol}): {token.balance}
                </li>
              ))}
            </ul>
          ) : (
            <p>No tokens found.</p>
          )}
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
