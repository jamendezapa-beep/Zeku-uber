// GET ?sesion=…  → tiendas del dueño que acaba de iniciar sesión con Uber.
// POST { sesion, store_ids: [] } → activa Zeku en esas tiendas y las registra.
import { NextRequest, NextResponse } from "next/server";
import { activateStore } from "@/lib/uber";
import { getJSON } from "@/lib/db";
import { saveRestaurant } from "@/lib/restaurants";
import { fail } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Session = { token: string; stores: { store_id: string; name: string; address: string }[] };

export async function GET(req: NextRequest) {
  const s = await getJSON<Session>(`prov:${req.nextUrl.searchParams.get("sesion")}`);
  if (!s) return NextResponse.json({ error: "La sesión venció. Vuelve a conectar con Uber." }, { status: 410 });
  return NextResponse.json({ stores: s.stores });
}

export async function POST(req: NextRequest) {
  const { sesion, store_ids } = await req.json().catch(() => ({}));
  const s = await getJSON<Session>(`prov:${sesion}`);
  if (!s) return NextResponse.json({ error: "La sesión venció. Vuelve a conectar con Uber." }, { status: 410 });
  const wanted: string[] = Array.isArray(store_ids) ? store_ids : [];
  // Solo se pueden activar tiendas que Uber devolvió para este dueño.
  const allowed = s.stores.filter((st) => wanted.includes(st.store_id));
  if (!allowed.length) return NextResponse.json({ error: "Elige al menos una tienda" }, { status: 400 });

  const results: { store_id: string; name: string; ok: boolean; error?: string }[] = [];
  for (const st of allowed) {
    try {
      await activateStore(s.token, st.store_id);
      await saveRestaurant({ store_id: st.store_id, name: st.name || st.store_id, address: st.address, active: true });
      results.push({ store_id: st.store_id, name: st.name, ok: true });
    } catch (e: any) {
      results.push({ store_id: st.store_id, name: st.name, ok: false, error: String(e?.message ?? e) });
    }
  }
  try {
    return NextResponse.json({ results });
  } catch (e) {
    return fail(e);
  }
}
