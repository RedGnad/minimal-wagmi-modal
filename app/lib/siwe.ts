// Minimal SIWE (EIP-4361) message builder for client-side usage.
// Backend should validate this message strictly and issue a session.

export interface BuildSiweParams {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version?: string; // default "1"
  chainId: number;
  nonce: string;
  issuedAt?: string; // ISO string
  expirationTime?: string; // ISO string
}

export function buildSiweMessage(p: BuildSiweParams): string {
  const {
    domain,
    address,
    statement = "Sign in to Sherlock",
    uri,
    version = "1",
    chainId,
    nonce,
    issuedAt = new Date().toISOString(),
    expirationTime,
  } = p;

  const header = `${domain} wants you to sign in with your Ethereum account:`;
  const addr = `${address}`;
  const line2 = "\n\n" + statement + "\n\n";
  const fields = [
    `URI: ${uri}`,
    `Version: ${version}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ];
  if (expirationTime) fields.push(`Expiration Time: ${expirationTime}`);

  return [header, addr, line2, ...fields].join("\n");
}

export function getBrowserContext() {
  if (typeof window === "undefined") return { domain: "localhost", uri: "http://localhost" };
  return { domain: window.location.host, uri: window.location.origin };
}
