import type { ActionFunctionArgs } from "react-router";
import { createNonce } from "../lib/server/nonceStore";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const { nonce, exp } = createNonce();
  return new Response(JSON.stringify({ nonce, exp }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
