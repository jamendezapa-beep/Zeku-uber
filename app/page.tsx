"use client";

import { useCallback, useEffect, useState } from "react";

type Order = {
  id: string;
  shortId: string;
  status: string;
  customer: string;
  items: string[];
  total: string | number;
  received_at: string;
  error?: string;
  delivery?: string;
  store_name?: string;
  ready_by?: string;
  cancel_reason?: string;
};

const card: React.CSSProperties = { background: "#181b22", borderRadius: 12, padding: 16, marginBottom: 16 };
const btn = (bg: string): React.CSSProperties => ({
  background: bg,
  color: "#fff",
  border: 0,
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 15,
  marginRight: 8,
  marginTop: 8,
});
const CANCEL_LABEL: Record<string, string> = {
  OUT_OF_ITEMS: "Sin stock de productos",
  KITCHEN_CLOSED: "Cocina cerrada",
  CUSTOMER_CALLED_TO_CANCEL: "El cliente pidió cancelar",
  RESTAURANT_TOO_BUSY: "Restaurante muy ocupado",
  CANNOT_COMPLETE_CUSTOMER_NOTE: "No se puede cumplir la nota del cliente",
  OTHER: "Otro motivo",
};

const STATUS_COLOR: Record<string, string> = {
  NEW: "#f5a524",
  ACCEPTED: "#17c964",
  READY: "#3b82f6",
  DELIVERED: "#a3a3a3",
  DENIED: "#f31260",
  CANCELLED: "#888",
  ERROR: "#f31260",
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data;
}

export default function Panel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [msg, setMsg] = useState("");
  const [check, setCheck] = useState<any>(null);
  const [store, setStore] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [events, setEvents] = useState<any[] | null>(null);
  const [prep, setPrep] = useState(20);
  const [cancelReason, setCancelReason] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [openEvent, setOpenEvent] = useState<number | null>(null);
  const [menuView, setMenuView] = useState<{ id: string; title: string; price?: number; soldOut: boolean }[] | null>(null);
  const [itemId, setItemId] = useState("");
  const [lastResult, setLastResult] = useState("");
  const [denyReason, setDenyReason] = useState("STORE_CLOSED");
  const validate = (key: string, label: string, extra: object = {}) =>
    run(label, async () => {
      setChecks((c) => ({ ...c, [key]: "…" }));
      try {
        const r = await api("/api/admin/validation", {
          method: "POST",
          body: JSON.stringify({ action: key, store: sel || undefined, item: itemId || undefined, ...extra }),
        });
        setChecks((c) => ({ ...c, [key]: "✅" }));
        setLastResult(JSON.stringify(r.result, null, 2).slice(0, 1500));
      } catch (e: any) {
        setChecks((c) => ({ ...c, [key]: "❌" }));
        setLastResult(String(e.message));
        throw e;
      }
    });
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [sel, setSel] = useState("");
  const qs = sel ? `?store=${encodeURIComponent(sel)}` : "";
  const today = new Date().toISOString().slice(0, 10);
  const [range, setRange] = useState({ start: today, end: today });

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setMsg(`${label}…`);
    try {
      await fn();
      setMsg(`${label}: listo`);
    } catch (e: any) {
      setMsg(`${label}: ${e.message}`);
    }
  };

  const loadOrders = useCallback(async () => {
    try {
      setOrders((await api("/api/admin/orders")).orders);
    } catch {}
  }, []);

  const loadRestaurants = useCallback(async () => {
    try {
      const list = (await api("/api/admin/restaurants")).restaurants;
      setRestaurants(list);
      setSel((cur) => cur || list.find((r: any) => r.active)?.store_id || "");
    } catch {}
  }, []);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    loadOrders();
    const t = setInterval(loadOrders, 15000);
    return () => clearInterval(t);
  }, [loadOrders]);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22 }}>Zeku · Uber Eats</h1>
      {msg && <p style={{ color: "#aaa" }}>{msg}</p>}

      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Conexión con Uber</h2>
        <button style={btn("#3b5bdb")} onClick={() => run("Validando keys", async () => setCheck(await api("/api/admin/check")))}>
          Validar API keys
        </button>
        {check && (
          <ul style={{ paddingLeft: 18 }}>
            {Object.entries(check.vars ?? {}).map(([k, v]) => (
              <li key={k}>{k}: {v ? "✅" : "❌ falta"}</li>
            ))}
            {Object.entries(check.scopes ?? {}).map(([k, v]) => (
              <li key={k}>{k}: {String(v) === "OK" ? "✅" : `⚠️ ${v}`}</li>
            ))}
            {check.error && <li>⚠️ {check.error}</li>}
          </ul>
        )}
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Restaurantes</h2>
        <p style={{ color: "#aaa", marginTop: 0 }}>
          Cada restaurante se conecta solo en <code>/conectar</code>, iniciando sesión con su cuenta de Uber Eats.
        </p>
        <a href="/conectar" style={{ ...btn("#000"), border: "1px solid #444", display: "inline-block", textDecoration: "none" }}>
          + Conectar restaurante
        </a>
        <button style={btn("#444")} onClick={loadRestaurants}>Actualizar</button>
        {restaurants.length === 0 && <p style={{ color: "#aaa" }}>Todavía no hay restaurantes conectados.</p>}
        {restaurants.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <label>
              Operar sobre:{" "}
              <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ fontSize: 15, padding: 6 }}>
                {restaurants.map((r) => (
                  <option key={r.store_id} value={r.store_id}>
                    {r.name}
                    {r.active ? "" : " (desactivado)"}
                  </option>
                ))}
              </select>
            </label>
            {restaurants.map((r) => (
              <div key={r.store_id} style={{ fontSize: 14, marginTop: 8 }}>
                {r.active ? "🟢" : "⚪"} {r.name}
                {r.address && <span style={{ color: "#aaa" }}> · {r.address}</span>}
                {r.active && r.connected_at && (
                  <button
                    style={{ ...btn("#333"), padding: "4px 8px", fontSize: 12, marginTop: 0, marginLeft: 8 }}
                    onClick={() =>
                      confirm(`¿Desconectar ${r.name} de Zeku? Dejará de recibir sus pedidos.`) &&
                      run("Desconectando", async () => {
                        await api("/api/admin/restaurants", { method: "POST", body: JSON.stringify({ store_id: r.store_id, action: "disable" }) });
                        await loadRestaurants();
                      })
                    }
                  >
                    Desconectar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Tienda</h2>
        <button style={btn("#444")} onClick={() => run("Consultando estado", async () => setStore(await api(`/api/admin/store${qs}`)))}>
          Ver estado
        </button>
        <button style={btn("#17a34a")} onClick={() => run("Abriendo", () => api("/api/admin/store", { method: "POST", body: JSON.stringify({ status: "ONLINE", store: sel || undefined }) }))}>
          Abrir
        </button>
        <button style={btn("#d97706")} onClick={() => run("Pausando 30 min", () => api("/api/admin/store", { method: "POST", body: JSON.stringify({ status: "PAUSED", minutes: 30, store: sel || undefined }) }))}>
          Pausar 30 min
        </button>
        <button style={btn("#6d28d9")} onClick={() => run("Buscando tiendas", async () => setStore(await api("/api/admin/stores")))}>
          Buscar mi Store ID
        </button>
        {store && <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(store, null, 2)}</pre>}
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Menú</h2>
        <p style={{ color: "#aaa", marginTop: 0 }}>Sube el menú de <code>data/menu.json</code> a Uber (reemplaza el actual).</p>
        <button style={btn("#3b5bdb")} onClick={() => confirm("¿Reemplazar el menú en Uber Eats?") && run("Subiendo menú", () => api("/api/admin/menu", { method: "POST", body: JSON.stringify({ store: sel || undefined }) }))}>
          Sincronizar menú
        </button>
        <button
          style={btn("#444")}
          onClick={() =>
            run("Leyendo menú en Uber", async () => {
              const m = await api(`/api/admin/menu${qs}`);
              const tr = (t: any) => t?.translations?.es ?? t?.translations?.es_es ?? Object.values(t?.translations ?? {})[0] ?? "";
              setMenuView(
                (m?.items ?? []).map((it: any) => {
                  const until = Number(it?.suspension_info?.suspension?.suspend_until ?? 0);
                  return {
                    id: it.id,
                    title: tr(it.title) || it.id,
                    price: it?.price_info?.price,
                    soldOut: until * 1000 > Date.now(),
                  };
                }),
              );
            })
          }
        >
          Ver menú en Uber
        </button>
        {menuView && menuView.length === 0 && <p style={{ color: "#aaa" }}>Uber no tiene productos en el menú de esta tienda.</p>}
        {menuView?.map((it) => (
          <div key={it.id} style={{ fontSize: 14, marginTop: 6 }}>
            {it.soldOut ? "🚫" : "✅"} {it.title}
            {typeof it.price === "number" && <span style={{ color: "#aaa" }}> · ${it.price}</span>}
            {it.soldOut && <span style={{ color: "#f5a524" }}> · agotado</span>}
            <div style={{ color: "#666", fontSize: 11 }}>ID: {it.id}</div>
          </div>
        ))}
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Pedidos</h2>
        <button style={btn("#444")} onClick={loadOrders}>Actualizar</button>
        {orders.length === 0 && <p style={{ color: "#aaa" }}>Aún no llegan pedidos.</p>}
        <div style={{ marginTop: 8, fontSize: 14 }}>
          Motivo si rechazas:{" "}
          <select value={denyReason} onChange={(e) => setDenyReason(e.target.value)} style={{ fontSize: 15, padding: 4, marginRight: 8 }}>
            <option value="STORE_CLOSED">Tienda cerrada</option>
            <option value="RESTAURANT_TOO_BUSY">Muy ocupados</option>
            <option value="ITEM_ISSUE">Problema con un producto</option>
            <option value="KITCHEN_CLOSED">Cocina cerrada</option>
            <option value="CAPACITY">Sin capacidad</option>
            <option value="OTHER">Otro</option>
          </select>
          <br />
          Tiempo de preparación al aceptar:{" "}
          <select value={prep} onChange={(e) => setPrep(Number(e.target.value))} style={{ fontSize: 15, padding: 4 }}>
            {[10, 15, 20, 25, 30, 40, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </div>
        {orders.map((o) => {
          const act = (label: string, body: object) =>
            run(label, async () => {
              await api(`/api/admin/orders/${o.id}`, { method: "POST", body: JSON.stringify(body) });
              await loadOrders();
            });
          const live = o.status === "NEW" || o.status === "ACCEPTED" || o.status === "READY" || o.status === "ERROR";
          const mins = Math.floor((now - new Date(o.received_at).getTime()) / 60000);
          const left = o.ready_by ? Math.round((new Date(o.ready_by).getTime() - now) / 60000) : null;
          return (
            <div key={o.id} style={{ borderTop: "1px solid #2a2e38", paddingTop: 12, marginTop: 12 }}>
              <strong>#{o.shortId}</strong>{" "}
              <span style={{ color: STATUS_COLOR[o.status] ?? "#aaa" }}>{o.status}</span>
              {live && (
                <span style={{ marginLeft: 8, fontSize: 14, color: mins >= 20 ? "#f5a524" : "#aaa" }}>⏱ hace {mins} min</span>
              )}
              <div style={{ color: "#aaa", fontSize: 13 }}>
                {new Date(o.received_at).toLocaleString("es-CL")} {o.store_name && `· ${o.store_name} `}
                {o.customer && `· ${o.customer}`} {o.total !== "" && `· ${o.total}`}
              </div>
              <div>{o.items.join(", ")}</div>
              {o.ready_by && (o.status === "ACCEPTED" || o.status === "READY") && (
                <div style={{ fontSize: 14, color: left !== null && left < 0 ? "#f31260" : "#7aa2ff" }}>
                  Retiro estimado: {new Date(o.ready_by).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                  {left !== null && (left >= 0 ? ` (faltan ${left} min)` : ` (atrasado ${-left} min)`)}
                </div>
              )}
              {o.delivery && <div style={{ color: "#aaa", fontSize: 13 }}>Repartidor: {o.delivery}</div>}
              {o.cancel_reason && <div style={{ color: "#aaa", fontSize: 13 }}>Motivo: {CANCEL_LABEL[o.cancel_reason] ?? o.cancel_reason}</div>}
              {o.error && <div style={{ color: "#f31260", fontSize: 13 }}>{o.error}</div>}

              <button
                style={{ ...btn("#333"), padding: "4px 8px", fontSize: 12 }}
                onClick={async () => {
                  setMsg("Consultando en Uber…");
                  try {
                    const r = await api(`/api/admin/orders/${o.id}`);
                    setMsg(`Pedido #${o.shortId} según Uber: ${r.current_state}`);
                  } catch (e: any) {
                    setMsg(`No se pudo consultar: ${e.message}`);
                  }
                }}
              >
                Ver estado en Uber
              </button>
              {(o.status === "NEW" || o.status === "ERROR") && (
                <>
                  <button style={btn("#17a34a")} onClick={() => act("Aceptando", { action: "accept", minutes: prep })}>
                    Aceptar ({prep} min)
                  </button>
                  <button style={btn("#dc2626")} onClick={() => confirm("¿Rechazar este pedido?") && act("Rechazando", { action: "deny", reason: denyReason })}>
                    Rechazar
                  </button>
                </>
              )}
              {o.status === "ACCEPTED" && (
                <button style={btn("#2563eb")} onClick={() => act("Marcando listo", { action: "ready" })}>
                  Listo para retiro
                </button>
              )}
              {(o.status === "ACCEPTED" || o.status === "READY") && (
                <div style={{ marginTop: 8 }}>
                  <select
                    value={cancelReason[o.id] ?? ""}
                    onChange={(e) => setCancelReason({ ...cancelReason, [o.id]: e.target.value })}
                    style={{ fontSize: 14, padding: 4 }}
                  >
                    <option value="">Motivo para cancelar…</option>
                    {Object.entries(CANCEL_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <button
                    style={{ ...btn("#7f1d1d"), opacity: cancelReason[o.id] ? 1 : 0.5 }}
                    disabled={!cancelReason[o.id]}
                    onClick={() =>
                      confirm(`¿Cancelar el pedido #${o.shortId}? El cliente será notificado y no se puede deshacer.`) &&
                      act("Cancelando", { action: "cancel", reason: cancelReason[o.id] })
                    }
                  >
                    Cancelar pedido
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Validación de Uber</h2>
        <p style={{ color: "#aaa", marginTop: 0 }}>
          Toca cada botón una vez, en orden. Uber revisa que Zeku haya usado cada endpoint con la tienda de prueba.
        </p>
        <label style={{ fontSize: 14 }}>
          ID del producto (vacío = el primero de data/menu.json):{" "}
          <input value={itemId} onChange={(e) => setItemId(e.target.value)} style={{ fontSize: 14, padding: 4, width: 160 }} />
        </label>
        {(
          [
            ["eats_stores", "1. Todas las tiendas (GET /v1/eats/stores)"],
            ["delivery_stores", "2. Tiendas (GET /v1/delivery/stores)"],
            ["delivery_store", "3. Detalle de tienda (GET /v1/delivery/store/{id})"],
            ["get_pos_data", "4. Ver integración (GET pos_data)"],
            ["patch_pos_data", "5. Actualizar integración (PATCH pos_data)"],
            ["upload_menu", "6. Subir menú (PUT menus)"],
            ["item_price", "7. Cambiar precio (POST menus/items)"],
            ["item_sold_out", "8. Marcar agotado (POST menus/items)"],
            ["item_available", "9. Volver a disponible (POST menus/items)"],
          ] as [string, string][]
        ).map(([k, label]) => (
          <div key={k}>
            <button
              style={{ ...btn("#334155"), width: "100%", textAlign: "left" }}
              onClick={() => validate(k, label, k === "item_price" ? { price: 5990 } : {})}
            >
              {checks[k] ?? "⬜"} {label}
            </button>
          </div>
        ))}
        <div style={{ marginTop: 12, fontSize: 13, color: "#aaa" }}>
          Ciclo de desactivación (hacer los dos, en orden):
        </div>
        <button
          style={{ ...btn("#7f1d1d"), width: "100%", textAlign: "left" }}
          onClick={() =>
            confirm("Esto quita la integración de la tienda. Justo después toca el paso 11 para reactivarla. ¿Seguir?") &&
            validate("delete_pos_data", "Quitar integración")
          }
        >
          {checks.delete_pos_data ?? "⬜"} 10. Quitar integración (DELETE pos_data)
        </button>
        <a
          href="/conectar"
          style={{ ...btn("#14532d"), width: "100%", textAlign: "left", display: "block", textDecoration: "none", boxSizing: "border-box" }}
        >
          ➡️ 11. Reactivar desde /conectar (GET /v1/eats/stores + POST pos_data)
        </a>
        {lastResult && <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, maxHeight: 240, overflow: "auto" }}>{lastResult}</pre>}
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Avisos de Uber</h2>
        <p style={{ color: "#aaa", marginTop: 0 }}>Todo lo que Uber ha enviado a Zeku, aunque haya sido rechazado. Toca un aviso para ver su contenido.</p>
        <button style={btn("#444")} onClick={() => run("Cargando avisos", async () => setEvents((await api("/api/admin/events")).events))}>
          Ver avisos
        </button>
        {events && events.length === 0 && <p style={{ color: "#aaa" }}>Uber todavía no ha enviado nada a Zeku.</p>}
        {events?.map((e, i) => (
          <div
            key={i}
            style={{ fontSize: 14, marginTop: 8, cursor: "pointer" }}
            onClick={() => setOpenEvent(openEvent === i ? null : i)}
          >
            {e.rejected ? "❌" : "✅"} {new Date(e.received_at).toLocaleString("es-CL")} · {e.type || "?"}
            {e.rejected && <span style={{ color: "#f31260" }}> · rechazado: {e.reason}</span>}
            {e.result && <div style={{ color: e.result.startsWith("error") ? "#f31260" : "#aaa", fontSize: 12, marginLeft: 22 }}>{e.result}</div>}
            {openEvent === i && e.raw && (
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, background: "#0f1115", padding: 8, borderRadius: 6 }}>{e.raw}</pre>
            )}
          </div>
        ))}
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Reportes</h2>
        <label>Desde <input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} /></label>{" "}
        <label>Hasta <input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} /></label>
        <div>
          <button style={btn("#3b5bdb")} onClick={() => run("Pidiendo reporte (llega en unos minutos)", () => api("/api/admin/reports", { method: "POST", body: JSON.stringify({ ...range, store: sel || undefined }) }))}>
            Pedir reporte
          </button>
          <button style={btn("#444")} onClick={() => run("Cargando reportes", async () => setReports((await api("/api/admin/reports")).reports))}>
            Ver recibidos
          </button>
        </div>
        {reports.map((r, i) => (
          <div key={i} style={{ marginTop: 8, fontSize: 14 }}>
            {new Date(r.received_at).toLocaleString("es-CL")} · {r.type}
            {r.links.map((l: string, j: number) => (
              <div key={j}><a href={l} style={{ color: "#7aa2ff" }}>Descargar {j + 1}</a></div>
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}
