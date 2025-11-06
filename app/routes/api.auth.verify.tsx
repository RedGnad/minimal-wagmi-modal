import type { ActionFunctionArgs } from "react-router";
import { consumeNonce } from "../lib/server/nonceStore";
import { recoverMessageAddress } from "viem";

interface VerifyPayload {
  address: `0x${string}`;
  message: string;
  signature: `0x${string}`;
}

const EXPECTED_CHAIN_ID = 10143; // Monad Testnet
const EXPECTED_DOMAIN =
  (import.meta as any).env?.VITE_SIWE_DOMAIN || "localhost:5173";

function extractNonce(message: string): string | null {
  const match = message.match(/\nNonce:\s*([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

function extractChainId(message: string): number | null {
  const match = message.match(/\nChain ID:\s*(\d+)/);
  return match ? Number(match[1]) : null;
}

function extractDomain(message: string): string | null {
  const firstLine = message.split("\n")[0]?.trim();
  const m = firstLine.match(/^(.*) wants you to sign in/);
  return m ? m[1] : null;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let payload: VerifyPayload | null = null;
  try {
    payload = (await request.json()) as VerifyPayload;
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (!payload?.address || !payload?.message || !payload?.signature) {
    return new Response("Missing fields", { status: 400 });
  }

  try {
    const recovered = await recoverMessageAddress({
      message: payload.message,
      signature: payload.signature,
    });
    if (recovered.toLowerCase() !== payload.address.toLowerCase()) {
      return new Response("Address mismatch", { status: 401 });
    }
  } catch (e: any) {
    return new Response(`Recover failed: ${e?.message || "error"}`, {
      status: 400,
    });
  }

  const nonce = extractNonce(payload.message);
  if (!nonce) return new Response("Nonce introuvable", { status: 400 });
  const consumed = consumeNonce(nonce);
  if (!consumed.ok)
    return new Response(consumed.error || "Nonce invalid", { status: 400 });

  const chainId = extractChainId(payload.message);
  if (chainId !== EXPECTED_CHAIN_ID) {
    return new Response("Invalid chainId", { status: 400 });
  }

  const domain = extractDomain(payload.message);
  if (domain !== EXPECTED_DOMAIN) {
    return new Response("Invalid domain", { status: 400 });
  }

  const token = `sess-${Math.random().toString(36).slice(2, 10)}`;

  return new Response(JSON.stringify({ ok: true, token }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
