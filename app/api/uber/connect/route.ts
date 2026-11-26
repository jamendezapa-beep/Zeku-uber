// Inicia "Conectar con Uber": manda al dueño del restaurante al login de Uber.
// La URL de retorno (registrarla en Uber como Redirect URI) es: https://TU-DOMINIO/api/uber/callback
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { authorizeUrl } from "@/lib/uber";
import { setJSON } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const state = randomUUID();
  await setJSON(`oauth-state:${state}`, { created_at: Date.now() }, 600);
  const redirectUri = `${req.nextUrl.origin}/api/uber/callback`;
  return NextResponse.redirect(authorizeUrl(redirectUri, state));
}
