// Almacenamiento mínimo sobre Upstash Redis (API REST, sin dependencias).
// Sin KV configurado usa memoria: sirve para probar, pero en Vercel se pierde entre invocaciones.

const url = process.env.KV_REST_API_URL;
const token = process.env.KV_REST_API_TOKEN;
const mem = new Map<string, string>();
const memLists = new Map<string, string[]>();

export const hasKV = Boolean(url && token);

async function redis<T = unknown>(...cmd: (string | number)[]): Promise<T> {
  const res = await fetch(url!, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV ${cmd[0]} falló: ${res.status}`);
  const data = (await res.json()) as { result: T };
  return data.result;
}

export async function getJSON<T>(key: string): Promise<T | null> {
  const raw = hasKV ? await redis<string | null>("GET", key) : mem.get(key) ?? null;
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function setJSON(key: string, value: unknown, ttlSeconds?: number) {
  const raw = JSON.stringify(value);
  if (!hasKV) return void mem.set(key, raw);
  if (ttlSeconds) await redis("SET", key, raw, "EX", ttlSeconds);
  else await redis("SET", key, raw);
}

/** Agrega un id al inicio de una lista (sin duplicar) y la recorta a `max`. */
export async function pushId(listKey: string, id: string, max = 500) {
  if (!hasKV) {
    const list = (memLists.get(listKey) ?? []).filter((x) => x !== id);
    list.unshift(id);
    memLists.set(listKey, list.slice(0, max));
    return;
  }
  await redis("LREM", listKey, 0, id);
  await redis("LPUSH", listKey, id);
  await redis("LTRIM", listKey, 0, max - 1);
}

export async function listIds(listKey: string, limit = 50): Promise<string[]> {
  if (!hasKV) return (memLists.get(listKey) ?? []).slice(0, limit);
  return redis<string[]>("LRANGE", listKey, 0, limit - 1);
}
