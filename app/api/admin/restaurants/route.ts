// GET: restaurantes conectados.  POST { store_id, action: "disable" }: desactiva Zeku en esa tienda.
import { NextRequest, NextResponse } from "next/server";
import { listRestaurants, setRestaurantActive } from "@/lib/restaurants";
import { deactivateStore } from "@/lib/uber";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const list = await listRestaurants();
    const fallback = process.env.UBER_STORE_ID;
    if (fallback && !list.some((r) => r.store_id === fallback)) {
      list.unshift({
        store_id: fallback,
        name: "Tienda principal (UBER_STORE_ID)",
        active: true,
        connected_at: "",
        updated_at: "",
      });
    }
    return NextResponse.json({ restaurants: list });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  const { store_id, action } = await req.json().catch(() => ({}));
  if (!store_id || action !== "disable") {
    return NextResponse.json({ error: "Se espera { store_id, action: 'disable' }" }, { status: 400 });
  }
  try {
    await deactivateStore(store_id);
    return NextResponse.json(await setRestaurantActive(store_id, false));
  } catch (e) {
    return fail(e);
  }
}
