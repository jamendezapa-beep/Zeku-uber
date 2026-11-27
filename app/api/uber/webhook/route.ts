// URL a registrar en el Uber Developer Dashboard: https://TU-DOMINIO/api/uber/webhook
//
// Según Uber: cada webhook se reconoce con HTTP 200 y cuerpo vacío, y luego se procesa.
// Aquí se responde de inmediato y el procesamiento corre después de la respuesta (after()).
import { NextRequest, after } from "next/server";
import { verifyUberSignature } from "@/lib/signature";
import { acceptOrder, getOrder, getPosData, getStoreDetails, getStoreStatus, uploadMenu } from "@/lib/uber";
import menu from "@/data/menu.json";
import { saveOrder, updateOrder } from "@/lib/orders";
import { getJSON, pushId, setJSON } from "@/lib/db";
import { getRestaurant, saveRestaurant, setRestaurantActive } from "@/lib/restaurants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ok = () => new Response(null, { status: 200 });
const EVENT_TTL = 60 * 60 * 24 * 14;

export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!verifyUberSignature(raw, req.headers.get("x-uber-signature"))) {
    // No viene de Uber (o la firma no coincide): se registra para diagnosticar y se rechaza.
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
    return new Response(null, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }

  const type: string = event.event_type ?? "";
  const eventId: string = event.event_id ?? event.webhook_meta?.webhook_msg_uuid ?? `${type}-${Date.now()}`;

  // Deduplicación: si Uber reintenta el mismo evento, se reconoce sin procesarlo de nuevo.
  try {
    if (await getJSON(`event:${eventId}`)) return ok();
    await setJSON(`event:${eventId}`, { received_at: new Date().toISOString(), event }, EVENT_TTL);
    await pushId("events", eventId, 200);
  } catch {
    // Si falla el registro, igual se reconoce el evento.
  }

  after(() => processEvent(type, event, eventId));
  return ok();
}

/** Procesa el evento después de responder 200 y guarda el resultado para verlo en el panel. */
async function processEvent(type: string, event: any, eventId: string) {
  const resourceId: string | undefined = event.meta?.resource_id;
  const storeId: string | undefined = type.startsWith("store.") ? extractStoreId(event) : undefined;
  let result = "recibido";

  try {
    if (type === "orders.notification" && resourceId) {
      const now = new Date().toISOString();
      await saveOrder({ id: resourceId, status: "NEW", received_at: now, updated_at: now });
      const detail = await getOrder(resourceId);
      await updateOrder(resourceId, { detail });
      result = "pedido leído (GET order)";
      if (process.env.UBER_AUTO_ACCEPT === "true") {
        await acceptOrder(resourceId);
        await updateOrder(resourceId, { status: "ACCEPTED" });
        result += " y aceptado";
      }
    } else if (type === "orders.cancel" && resourceId) {
      await updateOrder(resourceId, { status: "CANCELLED" });
      result = "pedido marcado como cancelado";
    } else if (type === "delivery.state_changed" && resourceId) {
      const state: string = String(event.meta?.status ?? event.status ?? "").toUpperCase();
      await updateOrder(resourceId, {
        delivery: state,
        ...(state === "COMPLETED" || state === "DELIVERED" ? { status: "DELIVERED" as const } : {}),
      });
      result = `repartidor: ${state}`;
    } else if (type === "store.provisioned" && storeId) {
      // 1) Verificar la integración (GET pos_data) y los datos de la tienda.
      const steps: string[] = [];
      const pos: any = await getPosData(storeId);
      steps.push(`GET pos_data OK (integración ${pos?.integration_enabled ?? pos?.pos_integration_enabled ?? "?"})`);
      let name = (await getRestaurant(storeId))?.name ?? storeId;
      try {
        const details: any = await getStoreDetails(storeId);
        name = details?.name ?? name;
      } catch {}
      await saveRestaurant({ store_id: storeId, name, active: true });
      // 2) Si Uber lo pide, subir el menú (PUT /menus).
      if (event.perform_refresh_menu) {
        await uploadMenu(menu, storeId);
        steps.push("menú subido (PUT menus)");
      }
      result = steps.join(" · ");
    } else if (type === "store.deprovisioned" && storeId) {
      await setRestaurantActive(storeId, false);
      result = "tienda desactivada en Zeku";
    } else if (type === "store.menu_refresh_request" && storeId) {
      await uploadMenu(menu, storeId);
      result = "menú subido (PUT menus)";
    } else if (type === "store.status.changed" && storeId) {
      let status =
        event.meta?.status ?? event.meta?.store_status ?? event.status ?? event.store_status ?? event.data?.status ?? "";
      try {
        const s: any = await getStoreStatus(storeId);
        status = s?.status ?? status;
      } catch {}
      await setJSON(`store-status:${storeId}`, { status, received_at: new Date().toISOString() });
      result = `estado de tienda: ${status || "?"}`;
    } else if (type.startsWith("eats.report")) {
      await setJSON(`report:${eventId}`, { received_at: new Date().toISOString(), event });
      await pushId("reports", eventId, 100);
      result = "reporte guardado";
    }
  } catch (e: any) {
    result = `error: ${String(e?.message ?? e).slice(0, 300)}`;
    if (type.startsWith("orders.") && resourceId) {
      await updateOrder(resourceId, { status: "ERROR", error: String(e?.message ?? e) }).catch(() => {});
    }
  }

  // Guardar el resultado junto al evento para el panel ("Avisos de Uber").
  try {
    const rec = await getJSON<any>(`event:${eventId}`);
    if (rec) await setJSON(`event:${eventId}`, { ...rec, result }, EVENT_TTL);
  } catch {}
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Busca el ID de la tienda en todos los lugares donde Uber puede enviarlo. */
function extractStoreId(event: any): string | undefined {
  const direct =
    event.store_id ??
    event.meta?.store_id ??
    event.meta?.resource_id ??
    event.resource_id ??
    event.store?.id ??
    event.store_uuid ??
    event.data?.store_id;
  if (typeof direct === "string" && direct) return direct;
  // resource_href: https://api.uber.com/v1/eats/store(s)/{uuid}/...
  const href: string = event.resource_href ?? event.meta?.resource_href ?? "";
  const m = href.match(/\/stores?\/([0-9a-f-]{36})/i);
  if (m) return m[1];
  // Último recurso: el primer UUID que aparezca junto a la palabra "store" en el aviso.
  const raw = JSON.stringify(event);
  const near = raw.match(/store[^"]*"\s*:\s*"([0-9a-f-]{36})"/i);
  if (near && UUID.test(near[1])) return near[1];
  return process.env.UBER_STORE_ID || undefined;
}
