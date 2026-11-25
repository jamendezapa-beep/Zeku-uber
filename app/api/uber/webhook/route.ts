// URL a registrar en el Uber Developer Dashboard: https://TU-DOMINIO/api/uber/webhook
import { NextRequest, NextResponse } from "next/server";
import { verifyUberSignature } from "@/lib/signature";
import { acceptOrder, getOrder } from "@/lib/uber";
import { saveOrder, updateOrder } from "@/lib/orders";
import { pushId, setJSON } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyUberSignature(raw, req.headers.get("x-uber-signature"))) {
    // Se registra para poder diagnosticar desde el panel (sin guardar el cuerpo completo).
    const id = `rechazado-${Date.now()}`;
    let type = "";
    try {
      type = JSON.parse(raw).event_type ?? "";
    } catch {}
    await setJSON(
      `event:${id}`,
      {
        received_at: new Date().toISOString(),
        rejected: true,
        reason: req.headers.get("x-uber-signature") ? "firma no coincide" : "sin firma",
        event: { event_type: type },
      },
      60 * 60 * 24 * 7,
    ).catch(() => {});
    await pushId("events", id, 200).catch(() => {});
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }

  const type: string = event.event_type ?? "";
  const resourceId: string | undefined = event.meta?.resource_id;

  // Registro de todos los eventos (útil para depurar con Uber)
  const eventId = event.event_id ?? `${Date.now()}`;
  await setJSON(`event:${eventId}`, { received_at: new Date().toISOString(), event }, 60 * 60 * 24 * 14);
  await pushId("events", eventId, 200);

  try {
    if (type === "orders.notification" && resourceId) {
      const now = new Date().toISOString();
      await saveOrder({ id: resourceId, status: "NEW", received_at: now, updated_at: now });
      const detail = await getOrder(resourceId);
      await updateOrder(resourceId, { detail });
      if (process.env.UBER_AUTO_ACCEPT === "true") {
        await acceptOrder(resourceId);
        await updateOrder(resourceId, { status: "ACCEPTED" });
      }
    } else if (type === "orders.cancel" && resourceId) {
      await updateOrder(resourceId, { status: "CANCELLED" });
    } else if (type.startsWith("eats.report")) {
      await setJSON(`report:${eventId}`, { received_at: new Date().toISOString(), event });
      await pushId("reports", eventId, 100);
    }
  } catch (e: any) {
    // Respondemos 200 igual: si devolvemos error Uber reintenta y duplica el evento.
    if (resourceId) await updateOrder(resourceId, { status: "ERROR", error: String(e?.message ?? e) });
  }

  return NextResponse.json({ ok: true });
}
