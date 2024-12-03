import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import axios from "axios";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import "./App.css";

ChartJS.register(ArcElement, Tooltip, Legend);

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moralisApiKey = import.meta.env.VITE_MORALIS_API_KEY;

  const fetchTokensAndPrices = async (address: string) => {
    setLoading(true);
    try {
      // Fetch ETH balance
      const provider = new ethers.BrowserProvider(window.ethereum);
      const ethBalance = parseFloat(
        ethers.formatEther(await provider.getBalance(address))
      );

      // Fetch ETH price from CoinGecko
      const ethPriceResponse = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price`,
        {
          params: {
            ids: "ethereum",
            vs_currencies: "usd",
          },
        }
      );

      const ethPrice = ethPriceResponse.data.ethereum.usd || 0;
      const ethTotal = ethBalance * ethPrice;

      // Include ETH if total value exceeds threshold
      const ethToken: TokenInfo | null =
        ethTotal > 0.00002
          ? {
              name: "Ethereum",
              symbol: "ETH",
              balance: ethBalance.toFixed(4),
              price: ethPrice,
              total: ethTotal,
            }
          : null;

      // Fetch other ERC20 tokens
      const tokenBalancesResponse = await axios.get(
        `https://deep-index.moralis.io/api/v2/${address}/erc20`,
        {
          headers: {
            "X-API-Key": moralisApiKey,
          },
          params: { chain: "eth" },
        }
      );

      const filteredTokens = tokenBalancesResponse.data.filter(
        (token: any) =>
          !token.name?.trim().startsWith("YT ") &&
          !token.name?.trim().startsWith("PT ")
      );

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
            const total = balance * price;

            return {
              name: token.name || "Unknown",
              symbol: token.symbol || "N/A",
              balance: balance.toFixed(4),
              price,
              total,
            };
          } catch (priceError) {
            return {
              name: token.name || "Unknown",
              symbol: token.symbol || "N/A",
              balance: (
                parseFloat(token.balance) / 10 ** token.decimals
              ).toFixed(4),
              price: 0,
              total: 0,
            };
          }
        })
      );

      const filteredTokensByTotal = tokensWithPrices.filter(
        (token) => token.total >= 0.00002
      );

      // Include ETH as the first token if it exists
      if (ethToken) {
        setTokens([ethToken, ...filteredTokensByTotal]);
      } else {
        setTokens(filteredTokensByTotal);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch tokens or prices.");
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletInfo = async (accounts: string[]) => {
    if (accounts.length === 0) {
      setWallet(null);
      setError("No accounts found. Please connect your wallet.");
      return;
    }

    const newAddress = accounts[0];
    if (wallet && wallet.address === newAddress) {
      return; // Prevent refetching if the wallet address hasn't changed
    }

    try {
      setError(null);
      setLoading(true);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = ethers.formatEther(await provider.getBalance(newAddress));
      const network = await provider.getNetwork();

      setWallet({
        address: newAddress,
        balance,
        chainName: network.name || "Unknown Network",
      });

      fetchTokensAndPrices(newAddress);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch wallet info.");
    } finally {
      setLoading(false);
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
      console.error(err);
      setError("Failed to connect wallet.");
    }
  };

  const disconnectWallet = () => {
    setWallet(null);
    setTokens([]);
    setError(null);
  };

  useEffect(() => {
    const handleAccountsChanged = (accounts: string[]) => {
      fetchWalletInfo(accounts);
    };

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, [wallet]);

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

          {loading ? (
            <p>Getting your tokens...</p>
          ) : tokens.length > 0 ? (
            <>
              <div className="chart-container">
                <Pie
                  data={{
                    labels: tokens.map((token) => token.symbol),
                    datasets: [
                      {
                        data: tokens.map((token) => token.total),
                        backgroundColor: tokens.map(
                          () =>
                            `hsl(${Math.floor(Math.random() * 360)}, 80%, 70%)`
                        ),
                        borderColor: "black",
                        borderWidth: 1,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      tooltip: {
                        callbacks: {
                          label: (context: any) =>
                            `$${context.raw.toFixed(2)}`,
                        },
                      },
                      legend: { position: "bottom" },
                    },
                  }}
                />
              </div>
              <ul className="token-list">
                {tokens.map((token, index) => (
                  <li key={index}>
                    <strong>{token.name}</strong> ({token.symbol}):{" "}
                    {token.balance}
                    <br />
                    <strong>Price:</strong> ${token.price.toFixed(7)}
                    <strong> | Total:</strong> ${token.total.toFixed(5)}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>No tokens available.</p>
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
