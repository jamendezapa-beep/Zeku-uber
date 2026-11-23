import { createHmac, timingSafeEqual } from "node:crypto";

/** Uber firma cada webhook con HMAC-SHA256 del body usando tu client secret (header X-Uber-Signature). */
export function verifyUberSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.UBER_CLIENT_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
