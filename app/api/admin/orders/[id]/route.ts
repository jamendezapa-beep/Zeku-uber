// POST { action: "accept", minutes? } | { action: "ready" } | { action: "deny", reason? } | { action: "cancel", reason, details? }
import { NextRequest, NextResponse } from "next/server";
import { acceptOrder, cancelOrder, CANCEL_REASONS, denyOrder, markOrderReady } from "@/lib/uber";
import { updateOrder } from "@/lib/orders";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "accept") {
      const minutes = Math.min(Math.max(Number(body.minutes) || 0, 0), 180);
      await acceptOrder(id, minutes);
      const now = Date.now();
      return NextResponse.json(
        await updateOrder(id, {
          status: "ACCEPTED",
          error: undefined,
          accepted_at: new Date(now).toISOString(),
          ...(minutes ? { ready_by: new Date(now + minutes * 60_000).toISOString() } : {}),
        }),
      );
    }
    if (body.action === "cancel") {
      const reason = CANCEL_REASONS.includes(body.reason) ? body.reason : "OTHER";
      await cancelOrder(id, reason, reason === "OTHER" ? body.details || "Cancelado por el restaurante" : undefined);
      return NextResponse.json(await updateOrder(id, { status: "CANCELLED", error: undefined, cancel_reason: reason }));
    }
    if (body.action === "ready") {
      await markOrderReady(id);
      return NextResponse.json(await updateOrder(id, { status: "READY", error: undefined }));
    }
    if (body.action === "deny") {
      await denyOrder(id, body.reason || "No podemos preparar el pedido en este momento");
      return NextResponse.json(await updateOrder(id, { status: "DENIED", error: undefined }));
    }
    return NextResponse.json({ error: "action debe ser accept, ready, cancel o deny" }, { status: 400 });
  } catch (e) {
    return fail(e);
  }
}
