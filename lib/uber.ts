// Cliente de la API de Uber Eats.
// Endpoints según la documentación de Uber Eats Marketplace; confirma contra la
// documentación que Uber te dio para tu integración (algunas rutas cambian por cuenta).

import { getJSON, setJSON } from "./db";

// UBER_ENV=production usa los servidores reales; cualquier otro valor (o vacío) usa sandbox.
const isProd = process.env.UBER_ENV === "production";
const AUTH_URL = isProd ? "https://auth.uber.com/oauth/v2/token" : "https://sandbox-login.uber.com/oauth/v2/token";
const API = isProd ? "https://api.uber.com" : "https://test-api.uber.com";

export class UberError extends Error {
  constructor(public status: number, public body: unknown, message: string) {
    super(message);
  }
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

export const storeId = () => env("UBER_STORE_ID");

type Token = { access_token: string; expires_at: number; scope: string };
let cached: Token | null = null;

/** Pide un token nuevo (client_credentials). También sirve para validar las keys. */
export async function requestToken(scope = process.env.UBER_SCOPES ?? "eats.store"): Promise<Token> {
  const body = new URLSearchParams({
    client_id: env("UBER_CLIENT_ID"),
    client_secret: env("UBER_CLIENT_SECRET"),
    grant_type: "client_credentials",
    scope,
  });
  const res = await fetch(AUTH_URL, { method: "POST", body, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new UberError(res.status, data, `Token rechazado: ${data.error ?? res.status}`);
  }
  return {
    access_token: data.access_token,
    scope: data.scope ?? scope,
    // margen de 5 min antes del vencimiento
    expires_at: Date.now() + (Number(data.expires_in ?? 2592000) - 300) * 1000,
  };
}

async function getToken(): Promise<string> {
  if (cached && cached.expires_at > Date.now()) return cached.access_token;
  const stored = await getJSON<Token>("uber:token").catch(() => null);
  if (stored && stored.access_token && stored.expires_at > Date.now()) {
    cached = stored;
    return stored.access_token;
  }
  cached = await requestToken();
  await setJSON("uber:token", cached, Math.floor((cached.expires_at - Date.now()) / 1000));
  return cached.access_token;
}

export async function uber<T = any>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? safeJSON(text) : null;
  if (res.status === 401 && !retried) {
    // Token vencido o de otro entorno: se descarta y se reintenta una vez con uno nuevo.
    cached = null;
    await setJSON("uber:token", null, 1).catch(() => {});
    return uber<T>(method, path, body, true);
  }
  if (!res.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data ?? "");
    throw new UberError(res.status, data, `Uber ${method} ${path}: ${res.status} ${detail.slice(0, 300)}`);
  }
  return data as T;
}

function safeJSON(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

// ---------- Pedidos ----------
export const getOrder = (orderId: string) => uber("GET", `/v2/eats/order/${orderId}`);

export const acceptOrder = (orderId: string) =>
  uber("POST", `/v1/eats/orders/${orderId}/accept_pos_order`, { reason: "accepted" });

export const denyOrder = (orderId: string, explanation: string, code = "STORE_CLOSED") =>
  uber("POST", `/v1/eats/orders/${orderId}/deny_pos_order`, { reason: { explanation, code } });

// ---------- Menú ----------
export const uploadMenu = (menu: unknown) => uber("PUT", `/v2/eats/stores/${storeId()}/menus`, menu);
export const fetchMenu = () => uber("GET", `/v2/eats/stores/${storeId()}/menus`);

// ---------- Tiendas ligadas a la app ----------
export const listStores = () => uber("GET", `/v1/eats/stores`);

// ---------- Estado de tienda ----------
export const getStoreStatus = () => uber("GET", `/v1/eats/store/${storeId()}/status`);

export const setStoreStatus = (status: "ONLINE" | "PAUSED", reason?: string, pausedUntil?: string) =>
  uber("POST", `/v1/eats/store/${storeId()}/status`, {
    status,
    ...(reason ? { reason } : {}),
    ...(pausedUntil ? { paused_until: pausedUntil } : {}),
  });

// ---------- Reportes ----------
export const requestReport = (reportType: string, startDate: string, endDate: string) =>
  uber("POST", `/v1/eats/report`, {
    report_type: reportType,
    store_uuids: [storeId()],
    start_date: startDate,
    end_date: endDate,
  });
