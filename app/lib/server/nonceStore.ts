// Simple in-memory nonce store for dev. Replace with Redis/DB in production.

const DEFAULT_TTL_MIN = Number((import.meta as any).env?.VITE_SIWE_EXP_MINUTES || 5);

type NonceRecord = { exp: number };
const store = new Map<string, NonceRecord>();

export function createNonce(ttlMin = DEFAULT_TTL_MIN): { nonce: string; exp: number } {
  const nonce = `n-${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`;
  const exp = Date.now() + ttlMin * 60_000;
  store.set(nonce, { exp });
  return { nonce, exp };
}

export function consumeNonce(nonce: string): { ok: boolean; error?: string } {
  const rec = store.get(nonce);
  if (!rec) return { ok: false, error: "Nonce inconnu" };
  store.delete(nonce);
  if (Date.now() > rec.exp) return { ok: false, error: "Nonce expiré" };
  return { ok: true };
}
