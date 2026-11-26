// GET: menú publicado en Uber.  POST: sube data/menu.json (reemplaza el menú completo en Uber).
import { NextRequest, NextResponse } from "next/server";
import { fetchMenu, uploadMenu } from "@/lib/uber";
import { fail } from "@/lib/http";
import menu from "@/data/menu.json";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await fetchMenu(req.nextUrl.searchParams.get("store")));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  const { store } = await req.json().catch(() => ({}));
  try {
    await uploadMenu(menu, store);
    return NextResponse.json({ ok: true, items: menu.items.length });
  } catch (e) {
    return fail(e);
  }
}
