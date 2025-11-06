import React from "react";
import {
  useConnect,
  useDisconnect,
  useAccount,
  useSignMessage,
  useConnectors,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { monadTestnet } from "../wagmi";
import { buildSiweMessage, getBrowserContext } from "../lib/siwe";
import {
  getNonce,
  verifySignatureLocally,
  verifySignatureOnServer,
} from "../lib/authClient";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSigned: (signature: string) => void;
  requireSignature?: boolean; // when true, modal acts as a blocking gate until signature success
}

const FALLBACK_MESSAGE = "Sherlock access login (fallback)";

export function LoginModal({
  open,
  onClose,
  onSigned,
  requireSignature,
}: LoginModalProps) {
  const requireServerVerify =
    (import.meta as any).env?.VITE_SIWE_REQUIRE_SERVER === "true";
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const [connectLock, setConnectLock] = React.useState<string | null>(null);
  const { connect, isPending, error: connectError } = useConnect();
  const connectors = useConnectors();
  const { disconnect } = useDisconnect();
  const {
    switchChain,
    isPending: switching,
    error: switchError,
  } = useSwitchChain();
  const {
    signMessage,
    data: signature,
    isPending: signing,
    error: signError,
    reset: resetSign,
    isSuccess,
  } = useSignMessage();
  const signRequestedRef = React.useRef(false);
  const gateActiveRef = React.useRef(false);
  const autoSwitchTriedRef = React.useRef(false);
  const [signStartTs, setSignStartTs] = React.useState<number | null>(null);
  const [retryFlag, setRetryFlag] = React.useState(false);
  const [nonce, setNonce] = React.useState<string | null>(null);
  const [dynamicMessage, setDynamicMessage] = React.useState<string | null>(
    null
  );
  const [localVerifyError, setLocalVerifyError] = React.useState<string | null>(
    null
  );
  const [serverVerifying, setServerVerifying] = React.useState(false);

  // Reset & prepare SIWE message on open/connect
  React.useEffect(() => {
    let cancelled = false;
    async function prep() {
      if (!open) return;
      signRequestedRef.current = false;
      gateActiveRef.current = false;
      autoSwitchTriedRef.current = false;
      resetSign();
      setLocalVerifyError(null);
      setDynamicMessage(null);
      setNonce(null);
      if (isConnected && address) {
        const n = await getNonce();
        if (cancelled) return;
        setNonce(n);
        const { domain, uri } = getBrowserContext();
        const msg = buildSiweMessage({
          domain,
          address,
          uri,
          chainId: chainId,
          nonce: n,
          statement: "Sign in to Sherlock",
        });
        setDynamicMessage(msg);
      }
    }
    prep();
    return () => {
      cancelled = true;
    };
  }, [open, resetSign, isConnected, address, chainId]);

  // If connected on wrong network while modal is open, auto-attempt one switch to Monad Testnet
  React.useEffect(() => {
    if (!open) return;
    if (
      isConnected &&
      chainId !== monadTestnet.id &&
      !autoSwitchTriedRef.current
    ) {
      autoSwitchTriedRef.current = true;
      try {
        switchChain({ chainId: monadTestnet.id });
      } catch {}
    }
    if (chainId === monadTestnet.id) {
      // allow another attempt if user manually changed back
      autoSwitchTriedRef.current = false;
    }
  }, [open, isConnected, chainId, switchChain]);

  // Remove obsolete post-sign switch handler (was used in previous flow)

  // When signature succeeds, perform local verification before closing.
  React.useEffect(() => {
    async function finalize() {
      if (
        !(open && signRequestedRef.current && isSuccess && signature && address)
      )
        return;
      const msgToVerify = dynamicMessage || FALLBACK_MESSAGE;
      const local = await verifySignatureLocally({
        address,
        message: msgToVerify,
        signature,
      });
      if (!local.ok) {
        setLocalVerifyError(local.error || "Local verify failed");
        return; // keep modal open so user can retry
      }
      // Server verify (SIWE) – optional in dev unless VITE_SIWE_REQUIRE_SERVER=true
      if (requireServerVerify) {
        setServerVerifying(true);
        const server = await verifySignatureOnServer({
          address,
          message: msgToVerify,
          signature,
        });
        if (!server.ok) {
          setServerVerifying(false);
          setLocalVerifyError(server.error || "Server verify failed");
          return;
        }
      }
      gateActiveRef.current = false;
      onSigned(signature);
      onClose();
    }
    finalize();
  }, [open, isSuccess, signature, address, dynamicMessage, onSigned, onClose]);

  if (!open) return null;

  const hasInjected =
    typeof window !== "undefined" && !!(window as any).ethereum;

  // Verrouillage strict: dès qu'un wallet est connecté (écran de sign-in),
  // on bloque la fermeture du modal (clic dehors / croix). "Disconnect" reste possible.
  // Cela évite toute désynchronisation avec des états externes.
  const lockClose = isConnected;
  // On conserve une notion d'activité de gate pour l'UI (état de signature/vérif)
  const signingGateActive = lockClose && (!isSuccess || serverVerifying);
  gateActiveRef.current = lockClose;

  return (
    <div
      style={styles.backdrop}
      onClick={(e) => {
        // Autoriser la fermeture uniquement si pas de lock
        if (!lockClose) onClose();
      }}
    >
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ ...styles.title, color: "#111" }}>Connect wallet</h2>
        {!isConnected ? (
          <div style={styles.section}>
            <div style={{ display: "grid", gap: 8 }}>
              {connectors.map((c) => {
                const locked = !!connectLock && connectLock !== c.id;
                const disabled = isPending || locked;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      if (disabled) return;
                      setConnectLock(c.id);
                      try {
                        // Request connect on Monad Testnet directly
                        // Wallets that don't have the chain will prompt to add it
                        // If passing chainId is unsupported by a connector, it will be ignored
                        // and the auto-switch handler below will attempt a switch post-connect
                        // ensuring we end up on Monad before signing.
                        connect({ connector: c, chainId: monadTestnet.id });
                      } finally {
                        // Release lock shortly after to allow wallet UI to appear without immediate spam
                        setTimeout(() => setConnectLock(null), 400);
                      }
                    }}
                    disabled={disabled}
                    aria-busy={disabled}
                    style={buttonStyle(disabled)}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            <small style={styles.note}>
              Select a wallet. Network will auto-switch to Monad Testnet.
            </small>
            {connectError && (
              <div style={styles.error}>
                Connection error: {connectError.message}
                {connectError.message?.includes(
                  "wallet_requestPermissions"
                ) && (
                  <div style={{ marginTop: 6 }}>
                    A request is already open in your wallet. Approve or close
                    the popup, then try again.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={styles.section}>
            <div style={styles.connectedBox}>
              <div style={{ color: "#111", fontWeight: 500 }}>Address</div>
              <div style={styles.address}>{address}</div>
            </div>
            {chainId !== monadTestnet.id && (
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  padding: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  background: "#fff7ed",
                  color: "#9a3412",
                }}
              >
                <div style={{ fontWeight: 600 }}>Wrong network</div>
                <div>Please switch to Monad Testnet to continue.</div>
                <button
                  onClick={() => switchChain({ chainId: monadTestnet.id })}
                  disabled={switching}
                  style={buttonStyle(switching)}
                >
                  {switching ? "Switching…" : "Switch to Monad Testnet"}
                </button>
                {switchError && (
                  <div style={styles.error}>
                    Switch error: {switchError.message}
                  </div>
                )}
              </div>
            )}
            <div style={styles.actionsRow}>
              <button
                onClick={() => {
                  // Clear signature state and allow re-selection
                  resetSign();
                  signRequestedRef.current = false;
                  disconnect();
                }}
                style={outlineButtonStyle}
              >
                Disconnect
              </button>
              <button
                onClick={() => {
                  if (chainId !== monadTestnet.id) {
                    try {
                      switchChain({ chainId: monadTestnet.id });
                    } catch {}
                    return;
                  }
                  signRequestedRef.current = true;
                  if (address) {
                    try {
                      localStorage.setItem(`sherlock_pending_${address}`, "1");
                    } catch {}
                  }
                  setRetryFlag(false);
                  setSignStartTs(Date.now());
                  signMessage({ message: dynamicMessage || FALLBACK_MESSAGE });
                }}
                disabled={
                  signing || chainId !== monadTestnet.id || !dynamicMessage
                }
                style={buttonStyle(signing)}
              >
                {signing
                  ? "Signing…"
                  : dynamicMessage
                    ? "Sign to continue"
                    : "Preparing…"}
              </button>
              {signing && signStartTs && Date.now() - signStartTs > 15000 && (
                <div style={{ fontSize: 12, color: "#9a3412" }}>
                  Signature taking longer than usual. You can retry.
                  <div style={{ marginTop: 6 }}>
                    <button
                      onClick={() => {
                        resetSign();
                        setRetryFlag(true);
                        setSignStartTs(Date.now());
                        signMessage({
                          message: dynamicMessage || FALLBACK_MESSAGE,
                        });
                      }}
                      style={outlineButtonStyle}
                    >
                      Retry signature
                    </button>
                  </div>
                </div>
              )}
              {retryFlag && !signing && !isSuccess && !signError && (
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Retry initiated. Await wallet popup…
                </div>
              )}
            </div>
            {(serverVerifying || signError || localVerifyError) && (
              <div
                style={{
                  ...styles.error,
                  color: serverVerifying ? "#6b7280" : styles.error.color,
                }}
              >
                {serverVerifying && "Verifying signature on server…"}
                {signError && <div>Signature error: {signError.message}</div>}
                {localVerifyError && <div>Auth error: {localVerifyError}</div>}
              </div>
            )}
          </div>
        )}
        {!lockClose && (
          <button
            onClick={() => {
              onClose();
            }}
            style={styles.close}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.40)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff",
    borderRadius: 12,
    padding: "24px 28px 32px",
    width: "360px",
    boxShadow: "0 8px 28px -6px rgba(0,0,0,0.25)",
    position: "relative",
    display: "grid",
    gap: 20,
    color: "#111",
    fontSize: 14,
  },
  title: { margin: 0, fontSize: 20, fontWeight: 600, color: "#111" },
  section: { display: "grid", gap: 14, color: "#111" },
  note: { color: "#374151", fontSize: 12 },
  connectedBox: { display: "grid", gap: 4, fontSize: 14, color: "#111" },
  address: {
    fontFamily: "monospace",
    fontSize: 13,
    wordBreak: "break-all",
    color: "#111",
  },
  actionsRow: { display: "flex", gap: 12, flexWrap: "wrap", color: "#111" },
  error: { color: "#b91c1c", fontSize: 13, fontWeight: 500 },
  close: {
    position: "absolute",
    top: 8,
    right: 10,
    background: "transparent",
    border: "none",
    fontSize: 22,
    cursor: "pointer",
    lineHeight: 1,
    color: "#111",
  },
};

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: disabled ? "#e5e7eb" : "#111",
    color: disabled ? "#374151" : "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 14,
    fontWeight: 500,
  };
}

const outlineButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  color: "#111",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 500,
};
