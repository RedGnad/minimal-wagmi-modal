import React from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { LoginModal } from "../components/LoginModal";

export function meta() {
  return [
    { title: "Connect Wallet" },
    { name: "description", content: "Login with EVM wallet (wagmi)" },
  ];
}

export default function Login() {
  const { address, isConnected, chain } = useAccount();
  const { connect, isPending, error } = useConnect();
  const hasInjected =
    typeof window !== "undefined" && !!(window as any).ethereum;
  const { disconnect } = useDisconnect();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [signed, setSigned] = React.useState(false);

  React.useEffect(() => {
    if (isConnected && address) {
      const key = `sherlock_auth_${address}`;
      setSigned(!!localStorage.getItem(key));
      // Auto-open modal if connected but not signed (gating on refresh)
      const pendingKey = `sherlock_pending_${address}`;
      if (!localStorage.getItem(key)) {
        setModalOpen(true);
      } else {
        // Clear any stale pending flag after successful auth
        localStorage.removeItem(pendingKey);
      }
    } else {
      setSigned(false);
    }
  }, [isConnected, address]);

  return (
    <main className="pt-16 p-4 container mx-auto" style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
        Wallet Login
      </h1>

      {isConnected ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div>Connected</div>
            <div style={{ fontFamily: "monospace" }}>{address}</div>
            {chain?.name && <div>Network: {chain.name}</div>}
          </div>
          {signed ? (
            <div style={{ color: "#16a34a" }}>Access granted (signed)</div>
          ) : (
            <div style={{ color: "#6b7280" }}>
              Signature required to access the app.
            </div>
          )}
          <button
            onClick={() => disconnect()}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fafafa",
              color: "#111",
              cursor: "pointer",
              width: "fit-content",
            }}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
              width: "fit-content",
            }}
          >
            Connect Wallet
          </button>
          {error && (
            <div style={{ color: "#b91c1c" }}>Error: {error.message}</div>
          )}
        </div>
      )}

      <LoginModal
        open={modalOpen}
        requireSignature={!signed}
        onClose={() => {
          // Autoriser fermeture si wallet non connecté (choix des wallets)
          // Bloquer seulement quand connecté et signature requise non encore réalisée
          if (!signed && isConnected) return;
          setModalOpen(false);
        }}
        onSigned={(sig) => {
          if (address) {
            localStorage.setItem(`sherlock_auth_${address}`, sig);
            localStorage.removeItem(`sherlock_pending_${address}`);
          }
          setSigned(true);
          setModalOpen(false);
        }}
      />
    </main>
  );
}
