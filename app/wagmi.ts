import { createConfig, http } from "wagmi";
import { injected, metaMask, walletConnect } from "wagmi/connectors";
import { defineChain } from "viem";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://monad-testnet.g.alchemy.com/v2/GmzSvBUT_o45yt7CzuavK"],
    },
    public: {
      http: ["https://monad-testnet.g.alchemy.com/v2/GmzSvBUT_o45yt7CzuavK"],
    },
  },
  blockExplorers: {
    default: { name: "Monad Scan", url: "https://testnet.monadscan.io" },
  },
  testnet: true,
});

const projectId = import.meta.env.VITE_WALLETCONNECT_ID as string | undefined;

const connectors = [
  // Injected covers Rabby, Phantom EVM, Backpack, etc.
  injected(),
  // Native MetaMask connector (can provide better UX on some platforms)
  metaMask(),
  // WalletConnect (QR / mobile). Only enabled if projectId provided.
  ...(projectId ? [walletConnect({ projectId })] : []),
];

const rpcUrl = (import.meta as any).env?.VITE_MONAD_RPC_URL || "https://monad-testnet.g.alchemy.com/v2/CHANGE_ME";

export const config = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(rpcUrl),
  },
  connectors,
});
