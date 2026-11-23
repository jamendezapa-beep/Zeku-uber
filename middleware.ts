// Protege el panel y la API de administración con usuario "admin" + ADMIN_PASSWORD.
// El webhook de Uber queda fuera (se valida por firma).
import { NextRequest, NextResponse } from "next/server";

export const config = { matcher: ["/", "/api/admin/:path*"] };

export function middleware(req: NextRequest) {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return new NextResponse("Configura ADMIN_PASSWORD en Vercel", { status: 503 });

  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [user, pwd] = atob(encoded).split(":");
    if (user === "admin" && pwd === pass) return NextResponse.next();
  }
  return new NextResponse("Autenticación requerida", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Zeku Uber"' },
  });
}
