// Resource route: POST /api/auth/nonce -> { nonce }
// Simple in-memory nonce store with expiration

import type { ActionFunctionArgs } from "react-router";

const NONCE_TTL_MIN = Number((import.meta as any).env?.VITE_SIWE_EXP_MINUTES || 5);
const nonces = new Map<string, number>(); // nonce -> expiresAt (ms)

function randomNonce(): string {
  // URL-safe base36 nonce
  return `n-${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const nonce = randomNonce();
  const exp = Date.now() + NONCE_TTL_MIN * 60_000;
  nonces.set(nonce, exp);
  const body = JSON.stringify({ nonce, exp });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// helper for verify route to check and consume nonce
export function consumeNonce(nonce: string): { ok: boolean; error?: string } {
  const exp = nonces.get(nonce);
  if (!exp) return { ok: false, error: "Nonce inconnu" };
  nonces.delete(nonce);
  if (Date.now() > exp) return { ok: false, error: "Nonce expiré" };
  return { ok: true };
}
