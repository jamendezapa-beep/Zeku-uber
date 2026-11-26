import { getJSON, listIds, pushId, setJSON } from "./db";

export type OrderRecord = {
  id: string;
  status: "NEW" | "ACCEPTED" | "READY" | "DELIVERED" | "DENIED" | "CANCELLED" | "ERROR";
  delivery?: string; // estado del repartidor que informa Uber
  accepted_at?: string;
  ready_by?: string; // hora estimada de retiro
  cancel_reason?: string;
  received_at: string;
  updated_at: string;
  detail?: any; // respuesta completa de GET /v2/eats/order/{id}
  error?: string;
};

export async function saveOrder(o: OrderRecord) {
  await setJSON(`order:${o.id}`, o);
  await pushId("orders", o.id);
}

export async function updateOrder(id: string, patch: Partial<OrderRecord>) {
  const cur = (await getJSON<OrderRecord>(`order:${id}`)) ?? {
    id,
    status: "NEW" as const,
    received_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const next = { ...cur, ...patch, updated_at: new Date().toISOString() };
  await saveOrder(next);
  return next;
}

export async function listOrders(limit = 50): Promise<OrderRecord[]> {
  const ids = await listIds("orders", limit);
  const all = await Promise.all(ids.map((id) => getJSON<OrderRecord>(`order:${id}`)));
  return all.filter(Boolean) as OrderRecord[];
}

/** Resumen corto para el panel. Los campos dependen de la versión de la API; se tolera que falten. */
export function summarize(o: OrderRecord) {
  const d = o.detail ?? {};
  const items = (d.cart?.items ?? []).map((i: any) => `${i.quantity ?? 1}× ${i.title ?? i.id}`);
  const total = d.payment?.charges?.total?.formatted_amount ?? d.payment?.charges?.total?.amount;
  return {
    id: o.id,
    shortId: d.display_id ?? o.id.slice(0, 8),
    status: o.status,
    customer: d.eater?.first_name ?? "",
    items,
    total: total ?? "",
    received_at: o.received_at,
    error: o.error,
    delivery: o.delivery ?? "",
    accepted_at: o.accepted_at ?? "",
    ready_by: o.ready_by ?? "",
    cancel_reason: o.cancel_reason ?? "",
    store_id: d.store?.id ?? "",
    store_name: d.store?.name ?? "",
  };
}
