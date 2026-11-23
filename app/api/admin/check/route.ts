// Valida las API keys de Uber: pide un token por cada scope y dice cuáles funcionan.
// Nunca devuelve el token ni el secret.
import { NextResponse } from "next/server";
import { requestToken, UberError } from "@/lib/uber";
import { hasKV } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const vars = {
    UBER_CLIENT_ID: Boolean(process.env.UBER_CLIENT_ID),
    UBER_CLIENT_SECRET: Boolean(process.env.UBER_CLIENT_SECRET),
    UBER_STORE_ID: Boolean(process.env.UBER_STORE_ID),
    base_de_datos: hasKV,
  };
  if (!vars.UBER_CLIENT_ID || !vars.UBER_CLIENT_SECRET) {
    return NextResponse.json({ ok: false, vars, error: "Faltan UBER_CLIENT_ID o UBER_CLIENT_SECRET" });
  }

  const scopes = (process.env.UBER_SCOPES ?? "eats.store eats.order eats.store.status.write eats.report")
    .split(/\s+/)
    .filter(Boolean);

  const results: Record<string, string> = {};
  for (const scope of scopes) {
    try {
      await requestToken(scope);
      results[scope] = "OK";
    } catch (e) {
      const err = e instanceof UberError ? (e.body as any)?.error ?? e.status : String(e);
      results[scope] =
        err === "invalid_client"
          ? "Keys inválidas (client_id o secret incorrectos)"
          : err === "unauthorized_client"
            ? "Keys reconocidas, pero Uber aún no habilita esta app para este scope"
          : err === "invalid_scope"
            ? "Keys válidas, pero Uber no habilitó este scope"
            : `Error: ${err}`;
    }
  }
  const ok = Object.values(results).some((r) => r === "OK");
  return NextResponse.json({ ok, vars, scopes: results });
}
