import React, { useState } from "react";
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
  price: number;
  total: number;
}

const App: React.FC = () => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const moralisApiKey = import.meta.env.VITE_MORALIS_API_KEY;

  const fetchTokensAndPrices = async (address: string) => {
    try {
      // Step 1: Fetch ERC-20 tokens
      const tokenBalancesResponse = await axios.get(
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

      console.log("Fetched Tokens:", tokenBalancesResponse.data);

      // Step 2: Filter out tokens starting with "YT " or "PT "
      const filteredTokens = tokenBalancesResponse.data.filter(
        (token: any) =>
          !token.name?.trim().startsWith("YT ") &&
          !token.name?.trim().startsWith("PT ")
      );

      // Step 3: Fetch prices for each token and calculate total
      const tokensWithPrices = await Promise.all(
        filteredTokens.map(async (token: any) => {
          try {
            const priceResponse = await axios.get(
              `https://deep-index.moralis.io/api/v2/erc20/${token.token_address}/price`,
              {
                headers: {
                  "X-API-Key": moralisApiKey,
                },
              }
            );

            const price = priceResponse.data.usdPrice || 0;
            const balance = parseFloat(token.balance) / 10 ** token.decimals;
            const total = balance * price; // Calculate total locally

            return {
              name: token.name || "Unknown",
              symbol: token.symbol || "N/A",
              balance: balance.toFixed(4),
              price,
              total,
            };
          } catch (priceError) {
            console.error(`Failed to fetch price for ${token.name}:`, priceError);
            return {
              name: token.name || "Unknown",
              symbol: token.symbol || "N/A",
              balance: (
                parseFloat(token.balance) /
                10 ** token.decimals
              ).toFixed(4),
              price: 0, // Fallback to 0 if price fetching fails
              total: 0, // Fallback total
            };
          }
        })
      );

      // Step 4: Filter out tokens with total < $0.00002
      const filteredTokensByTotal = tokensWithPrices.filter(
        (token) => token.total >= 0.00002
      );

      setTokens(filteredTokensByTotal);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching tokens and prices:", err);
      setError("Failed to fetch tokens or prices.");
    }
  };

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

      // Fetch tokens and prices once when the wallet is connected
      fetchTokensAndPrices(account);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching wallet info:", err);
      setError("Failed to fetch wallet info.");
    }
  };

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
      console.error("Error connecting wallet:", err);
      setError("Failed to connect wallet.");
    }
  };

  const disconnectWallet = () => {
    setWallet(null);
    setTokens([]);
    setError(null);
  };

  return (
    <div className="container">
      <h1 className="title">Wallet Connection</h1>
      {error && <p className="error">Error: {error}</p>}

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
                  <strong>{token.name}</strong> ({token.symbol}): {token.balance}
                  <br />
                  <strong>Price:</strong> ${token.price.toFixed(7)}
                  <strong> | Total:</strong> ${token.total.toFixed(5)}
                </li>
              ))}
            </ul>
          ) : (
            <p>Getting your tokens</p>
          )}
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
