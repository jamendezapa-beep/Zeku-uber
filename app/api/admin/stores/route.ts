// Lista las tiendas que Uber ligó a esta app (para obtener el UBER_STORE_ID).
import { NextResponse } from "next/server";
import { listStores } from "@/lib/uber";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data: any = await listStores();
    const stores = (data?.stores ?? data?.data ?? []).map((s: any) => ({
      id: s.store_id ?? s.id ?? s.uuid,
      name: s.name ?? s.title ?? "",
    }));
    return NextResponse.json({ stores, raw: stores.length ? undefined : data });
  } catch (e) {
    return fail(e);
  }
}
