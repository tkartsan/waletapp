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

// Custom plugin to draw a border for the pie chart
const drawBorderPlugin = {
  id: "drawBorderPlugin",
  beforeDraw: (chart: any) => {
    const { ctx, chartArea } = chart;
    const { width, height, left, top } = chartArea;

    ctx.save();
    ctx.strokeStyle = "black"; // Border color
    ctx.lineWidth = 1; // Border width

    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const radius = Math.min(width, height) / 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
  },
};

ChartJS.register(drawBorderPlugin);

const App: React.FC = () => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moralisApiKey = import.meta.env.VITE_MORALIS_API_KEY;
  const cryptocompareApiKey = "YOUR_CRYPTOCOMPARE_API_KEY";

  const fetchTokensAndPrices = async (address: string) => {
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const ethBalance = parseFloat(
        ethers.formatEther(await provider.getBalance(address))
      );

      const ethPriceResponse = await axios.get(
        `https://min-api.cryptocompare.com/data/price`,
        {
          params: {
            fsym: "ETH",
            tsyms: "USD",
            api_key: cryptocompareApiKey,
          },
        }
      );

      const ethPrice = ethPriceResponse.data.USD || 0;
      const ethTotal = ethBalance * ethPrice;

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

      const tokenPrices = filteredTokens.map(async (token: any) => {
        const balance = parseFloat(token.balance) / 10 ** token.decimals;

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
          const total = balance * price;

          return {
            name: token.name || "Unknown",
            symbol: token.symbol || "N/A",
            balance: balance.toFixed(4),
            price,
            total,
          };
        } catch (err) {
          return {
            name: token.name || "Unknown",
            symbol: token.symbol || "N/A",
            balance: balance.toFixed(4),
            price: 0,
            total: 0,
          };
        }
      });

      const tokensWithPrices = await Promise.all(tokenPrices);

      const filteredTokensByTotal = tokensWithPrices.filter(
        (token) => token.total >= 0.00002
      );

      if (ethToken) {
        setTokens([ethToken, ...filteredTokensByTotal]);
      } else {
        setTokens(filteredTokensByTotal);
      }
    } catch (err: any) {
      setError("Failed to fetch tokens or prices.");
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
      setError("Failed to connect wallet.");
    }
  };

  const fetchWalletInfo = async (accounts: string[]) => {
    if (accounts.length === 0) {
      setWallet(null);
      setError("No accounts found. Please connect your wallet.");
      return;
    }

    const newAddress = accounts[0];
    try {
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
      setError("Failed to fetch wallet info.");
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
      <h1 className="title">Tokens Overview</h1>
      {error && <p className="error">Error: {error}</p>}

      {wallet ? (
        <div className="wallet-info">
          <p>
            <strong>Wallet Address:</strong> {wallet.address}
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
