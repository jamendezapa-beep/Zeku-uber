// GET: estado actual.  POST { status: "ONLINE" | "PAUSED", minutes?: number, reason?: string }
import { NextRequest, NextResponse } from "next/server";
import { getStoreStatus, setStoreStatus } from "@/lib/uber";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await getStoreStatus(req.nextUrl.searchParams.get("store")));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  const { status, minutes, reason, store } = await req.json().catch(() => ({}));
  if (status !== "ONLINE" && status !== "PAUSED") {
    return NextResponse.json({ error: "status debe ser ONLINE o PAUSED" }, { status: 400 });
  }
  const until =
    status === "PAUSED" && Number(minutes) > 0
      ? new Date(Date.now() + Number(minutes) * 60_000).toISOString()
      : undefined;
  try {
    await setStoreStatus(status, status === "PAUSED" ? reason || "PAUSED_BY_RESTAURANT" : undefined, until, store);
    return NextResponse.json({ ok: true, status, paused_until: until ?? null });
  } catch (e) {
    return fail(e);
  }
}
