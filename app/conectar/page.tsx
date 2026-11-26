"use client";

// Página pública para que cada restaurante conecte su tienda de Uber Eats con Zeku.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Store = { store_id: string; name: string; address: string };
type Result = { store_id: string; name: string; ok: boolean; error?: string };

const box: React.CSSProperties = { background: "#181b22", borderRadius: 12, padding: 20, marginTop: 16 };
const button: React.CSSProperties = {
  background: "#000",
  color: "#fff",
  border: "1px solid #444",
  borderRadius: 10,
  padding: "14px 18px",
  fontSize: 17,
  width: "100%",
  textAlign: "center",
  textDecoration: "none",
  display: "block",
};

function Conectar() {
  const params = useSearchParams();
  const sesion = params.get("sesion");
  const error = params.get("error");
  const [stores, setStores] = useState<Store[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [results, setResults] = useState<Result[] | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!sesion) return;
    fetch(`/api/uber/provision?sesion=${encodeURIComponent(sesion)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setMsg(d.error);
        else {
          setStores(d.stores);
          setPicked(d.stores.map((s: Store) => s.store_id));
        }
      })
      .catch(() => setMsg("No se pudieron cargar tus tiendas."));
  }, [sesion]);

  const activate = async () => {
    setMsg("Activando…");
    const r = await fetch("/api/uber/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sesion, store_ids: picked }),
    });
    const d = await r.json().catch(() => ({}));
    if (d.error) setMsg(d.error);
    else {
      setMsg("");
      setResults(d.results);
    }
  };

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 24 }}>Conecta tu restaurante con Zeku</h1>
      <p style={{ color: "#aaa" }}>
        Zeku recibirá los pedidos de Uber Eats de tu tienda para que puedas aceptarlos y gestionarlos.
      </p>

      {error && <div style={{ ...box, color: "#f31260" }}>No se pudo conectar: {error}</div>}
      {msg && <p style={{ color: "#aaa" }}>{msg}</p>}

      {!sesion && (
        <div style={box}>
          <p style={{ marginTop: 0 }}>1. Inicia sesión con la cuenta de Uber Eats de tu restaurante.</p>
          <a href="/api/uber/connect" style={button}>
            Iniciar sesión con Uber
          </a>
        </div>
      )}

      {stores && !results && (
        <div style={box}>
          <p style={{ marginTop: 0 }}>2. Elige las tiendas que quieres conectar:</p>
          {stores.length === 0 && <p style={{ color: "#aaa" }}>Uber no encontró tiendas en esta cuenta.</p>}
          {stores.map((s) => (
            <label key={s.store_id} style={{ display: "block", padding: "8px 0" }}>
              <input
                type="checkbox"
                checked={picked.includes(s.store_id)}
                onChange={(e) =>
                  setPicked(e.target.checked ? [...picked, s.store_id] : picked.filter((x) => x !== s.store_id))
                }
              />{" "}
              <strong>{s.name || s.store_id}</strong>
              {s.address && <div style={{ color: "#aaa", fontSize: 13, marginLeft: 22 }}>{s.address}</div>}
            </label>
          ))}
          {stores.length > 0 && (
            <button style={{ ...button, background: "#17a34a", border: 0, marginTop: 12 }} onClick={activate}>
              Conectar {picked.length} tienda{picked.length === 1 ? "" : "s"}
            </button>
          )}
        </div>
      )}

      {results && (
        <div style={box}>
          {results.map((r) => (
            <div key={r.store_id} style={{ padding: "6px 0" }}>
              {r.ok ? "✅" : "❌"} {r.name || r.store_id}
              {r.error && <div style={{ color: "#f31260", fontSize: 13 }}>{r.error}</div>}
            </div>
          ))}
          {results.some((r) => r.ok) && <p>¡Listo! Los pedidos de Uber Eats de estas tiendas ya llegan a Zeku.</p>}
        </div>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Conectar />
    </Suspense>
  );
}
