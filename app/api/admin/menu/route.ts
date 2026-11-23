// GET: menú publicado en Uber.  POST: sube data/menu.json (reemplaza el menú completo en Uber).
import { NextResponse } from "next/server";
import { fetchMenu, uploadMenu } from "@/lib/uber";
import { fail } from "@/lib/http";
import menu from "@/data/menu.json";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await fetchMenu());
  } catch (e) {
    return fail(e);
  }
}

export async function POST() {
  try {
    await uploadMenu(menu);
    return NextResponse.json({ ok: true, items: menu.items.length });
  } catch (e) {
    return fail(e);
  }
}
