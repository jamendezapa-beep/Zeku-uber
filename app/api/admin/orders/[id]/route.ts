// POST { action: "accept" } o { action: "deny", reason?: string }
import { NextRequest, NextResponse } from "next/server";
import { acceptOrder, denyOrder } from "@/lib/uber";
import { updateOrder } from "@/lib/orders";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "accept") {
      await acceptOrder(id);
      return NextResponse.json(await updateOrder(id, { status: "ACCEPTED", error: undefined }));
    }
    if (body.action === "deny") {
      await denyOrder(id, body.reason || "No podemos preparar el pedido en este momento");
      return NextResponse.json(await updateOrder(id, { status: "DENIED", error: undefined }));
    }
    return NextResponse.json({ error: "action debe ser accept o deny" }, { status: 400 });
  } catch (e) {
    return fail(e);
  }
}
