// Uber vuelve aquí después del login del dueño. Se canjea el código por un token,
// se listan sus tiendas y se guarda una sesión corta para que elija cuáles activar.
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { exchangeCode, merchantStores } from "@/lib/uber";
import { getJSON, setJSON } from "@/lib/db";
import { parseStores } from "@/lib/restaurants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const back = (q: string) => NextResponse.redirect(`${origin}/conectar?${q}`);

  const error = req.nextUrl.searchParams.get("error");
  if (error) return back(`error=${encodeURIComponent(error)}`);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || !(await getJSON(`oauth-state:${state}`))) {
    return back("error=sesion_invalida");
  }
  await setJSON(`oauth-state:${state}`, null, 1);

  try {
    const token = await exchangeCode(code, `${origin}/api/uber/callback`);
    const stores = parseStores(await merchantStores(token));
    const session = randomUUID();
    // El token del dueño se guarda solo 30 minutos y nunca se envía al navegador.
    await setJSON(`prov:${session}`, { token, stores }, 1800);
    return back(`sesion=${session}`);
  } catch (e: any) {
    return back(`error=${encodeURIComponent(String(e?.message ?? e).slice(0, 200))}`);
  }
}
