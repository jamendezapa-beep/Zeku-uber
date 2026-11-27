// Últimos avisos (webhooks) que Uber mandó a Zeku, aceptados o rechazados.
import { NextResponse } from "next/server";
import { getJSON, listIds } from "@/lib/db";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ids = await listIds("events", 20);
    const all = await Promise.all(ids.map((id) => getJSON<any>(`event:${id}`)));
    return NextResponse.json({
      events: all.filter(Boolean).map((e) => ({
        received_at: e.received_at,
        type: e.event?.event_type ?? "",
        rejected: Boolean(e.rejected),
        reason: e.reason ?? "",
        result: e.result ?? "",
        raw: e.event ? JSON.stringify(e.event, null, 2).slice(0, 2000) : "",
      })),
    });
  } catch (e) {
    return fail(e);
  }
}
