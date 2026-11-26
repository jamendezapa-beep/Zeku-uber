// Registro de restaurantes conectados a Zeku (una entrada por tienda de Uber Eats).
import { getJSON, listIds, pushId, setJSON } from "./db";

export type Restaurant = {
  store_id: string;
  name: string;
  address?: string;
  active: boolean;
  connected_at: string;
  updated_at: string;
};

export async function saveRestaurant(r: Omit<Restaurant, "connected_at" | "updated_at"> & Partial<Restaurant>) {
  const prev = await getJSON<Restaurant>(`restaurant:${r.store_id}`);
  const now = new Date().toISOString();
  const next: Restaurant = {
    ...prev,
    ...r,
    connected_at: prev?.connected_at ?? r.connected_at ?? now,
    updated_at: now,
  } as Restaurant;
  await setJSON(`restaurant:${r.store_id}`, next);
  await pushId("restaurants", r.store_id, 1000);
  return next;
}

export async function setRestaurantActive(storeId: string, active: boolean) {
  const prev = await getJSON<Restaurant>(`restaurant:${storeId}`);
  return saveRestaurant({ store_id: storeId, name: prev?.name ?? storeId, address: prev?.address, active });
}

export async function getRestaurant(storeId: string) {
  return getJSON<Restaurant>(`restaurant:${storeId}`);
}

export async function listRestaurants(): Promise<Restaurant[]> {
  const ids = await listIds("restaurants", 1000);
  const all = await Promise.all(ids.map((id) => getJSON<Restaurant>(`restaurant:${id}`)));
  return (all.filter(Boolean) as Restaurant[]).sort((a, b) => a.name.localeCompare(b.name));
}

/** Normaliza la respuesta de GET /v1/eats/stores (el formato varía según versión). */
export function parseStores(data: any): { store_id: string; name: string; address: string }[] {
  const list = data?.stores ?? data?.data ?? (Array.isArray(data) ? data : []);
  return list
    .map((s: any) => ({
      store_id: s.store_id ?? s.id ?? s.uuid ?? "",
      name: s.name ?? s.title ?? "",
      address: [s.location?.address, s.location?.city].filter(Boolean).join(", "),
    }))
    .filter((s: { store_id: string }) => s.store_id);
}
