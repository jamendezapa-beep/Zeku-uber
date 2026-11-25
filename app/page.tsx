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
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Tienda</h2>
        <button style={btn("#444")} onClick={() => run("Consultando estado", async () => setStore(await api("/api/admin/store")))}>
          Ver estado
        </button>
        <button style={btn("#17a34a")} onClick={() => run("Abriendo", () => api("/api/admin/store", { method: "POST", body: JSON.stringify({ status: "ONLINE" }) }))}>
          Abrir
        </button>
        <button style={btn("#d97706")} onClick={() => run("Pausando 30 min", () => api("/api/admin/store", { method: "POST", body: JSON.stringify({ status: "PAUSED", minutes: 30 }) }))}>
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
        <button style={btn("#3b5bdb")} onClick={() => confirm("¿Reemplazar el menú en Uber Eats?") && run("Subiendo menú", () => api("/api/admin/menu", { method: "POST" }))}>
          Sincronizar menú
        </button>
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Pedidos</h2>
        <button style={btn("#444")} onClick={loadOrders}>Actualizar</button>
        {orders.length === 0 && <p style={{ color: "#aaa" }}>Aún no llegan pedidos.</p>}
        {orders.map((o) => (
          <div key={o.id} style={{ borderTop: "1px solid #2a2e38", paddingTop: 12, marginTop: 12 }}>
            <strong>#{o.shortId}</strong>{" "}
            <span style={{ color: STATUS_COLOR[o.status] ?? "#aaa" }}>{o.status}</span>
            <div style={{ color: "#aaa", fontSize: 13 }}>
              {new Date(o.received_at).toLocaleString("es-CL")} {o.customer && `· ${o.customer}`} {o.total !== "" && `· ${o.total}`}
            </div>
            <div>{o.items.join(", ")}</div>
            {o.delivery && <div style={{ color: "#aaa", fontSize: 13 }}>Repartidor: {o.delivery}</div>}
            {o.status === "ACCEPTED" && (
              <button style={btn("#2563eb")} onClick={() => run("Marcando listo", async () => { await api(`/api/admin/orders/${o.id}`, { method: "POST", body: JSON.stringify({ action: "ready" }) }); await loadOrders(); })}>
                Listo para retiro
              </button>
            )}
            {o.error && <div style={{ color: "#f31260", fontSize: 13 }}>{o.error}</div>}
            {(o.status === "NEW" || o.status === "ERROR") && (
              <>
                <button style={btn("#17a34a")} onClick={() => run("Aceptando", async () => { await api(`/api/admin/orders/${o.id}`, { method: "POST", body: JSON.stringify({ action: "accept" }) }); await loadOrders(); })}>
                  Aceptar
                </button>
                <button style={btn("#dc2626")} onClick={() => run("Rechazando", async () => { await api(`/api/admin/orders/${o.id}`, { method: "POST", body: JSON.stringify({ action: "deny" }) }); await loadOrders(); })}>
                  Rechazar
                </button>
              </>
            )}
          </div>
        ))}
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Avisos de Uber</h2>
        <p style={{ color: "#aaa", marginTop: 0 }}>Todo lo que Uber ha enviado a Zeku, aunque haya sido rechazado.</p>
        <button style={btn("#444")} onClick={() => run("Cargando avisos", async () => setEvents((await api("/api/admin/events")).events))}>
          Ver avisos
        </button>
        {events && events.length === 0 && <p style={{ color: "#aaa" }}>Uber todavía no ha enviado nada a Zeku.</p>}
        {events?.map((e, i) => (
          <div key={i} style={{ fontSize: 14, marginTop: 8 }}>
            {e.rejected ? "❌" : "✅"} {new Date(e.received_at).toLocaleString("es-CL")} · {e.type || "?"}
            {e.rejected && <span style={{ color: "#f31260" }}> · rechazado: {e.reason}</span>}
          </div>
        ))}
      </section>

      <section style={card}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Reportes</h2>
        <label>Desde <input type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} /></label>{" "}
        <label>Hasta <input type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} /></label>
        <div>
          <button style={btn("#3b5bdb")} onClick={() => run("Pidiendo reporte (llega en unos minutos)", () => api("/api/admin/reports", { method: "POST", body: JSON.stringify(range) }))}>
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
