import { NextResponse } from "next/server";
import { UberError } from "./uber";

/** Convierte errores (incluidos los de Uber) en una respuesta JSON legible para el panel. */
export function fail(e: unknown) {
  if (e instanceof UberError) {
    return NextResponse.json({ error: e.message, uber: e.body }, { status: e.status >= 500 ? 502 : e.status });
  }
  return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
}
