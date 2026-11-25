import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Uber firma cada webhook con HMAC-SHA256 del body (header X-Uber-Signature).
 * Se prueba con la Signing Key, la Secondary Signing Key y el client secret,
 * y se acepta la firma en hex o base64, con o sin prefijo "sha256=".
 */
export function verifyUberSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const sig = signature.trim().replace(/^sha256=/i, "");
  const keys = [
    process.env.UBER_WEBHOOK_SIGNING_KEY,
    process.env.UBER_WEBHOOK_SECONDARY_SIGNING_KEY,
    process.env.UBER_CLIENT_SECRET,
  ].filter(Boolean) as string[];

  for (const key of keys) {
    const mac = createHmac("sha256", key).update(rawBody);
    const digest = mac.digest();
    for (const expected of [digest.toString("hex"), digest.toString("base64")]) {
      const a = Buffer.from(expected);
      const b = Buffer.from(expected.length === 64 ? sig.toLowerCase() : sig);
      if (a.length === b.length && timingSafeEqual(a, b)) return true;
    }
  }
  return false;
}
