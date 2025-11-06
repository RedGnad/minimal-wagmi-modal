import { recoverMessageAddress } from "viem";

// Client-side auth helpers. Backend dev can replace fetch targets and validation.

export async function getNonce(): Promise<string> {
  // Try server endpoint first
  try {
    const res = await fetch("/api/auth/nonce", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data?.nonce) return String(data.nonce);
    }
  } catch {}
  // Dev fallback: random nonce (not for production)
  return `dev-${Math.random().toString(36).slice(2, 10)}`;
}

export async function verifySignatureOnServer(params: {
  address: `0x${string}`;
  message: string;
  signature: `0x${string}`;
}): Promise<{ ok: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, token: data?.token };
    }
    const text = await res.text();
    return { ok: false, error: text || `Server verify failed (${res.status})` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Network error" };
  }
}

export async function verifySignatureLocally(params: {
  address: `0x${string}`;
  message: string;
  signature: `0x${string}`;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const recovered = await recoverMessageAddress({
      message: params.message,
      signature: params.signature,
    });
    const ok = recovered.toLowerCase() === params.address.toLowerCase();
    return ok ? { ok } : { ok: false, error: "Recovered address mismatch" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Recover failed" };
  }
}
