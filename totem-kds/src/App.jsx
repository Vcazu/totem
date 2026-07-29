import React, { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import { Clock, ChefHat, CheckCircle2, Utensils, Bell, Wifi, WifiOff } from "lucide-react";

// ---------------------------------------------------------------------------
// CONFIG — aponte para a URL da sua API (mesmo backend do totem)
// ---------------------------------------------------------------------------
const API_URL = "http://localhost:3001";

const STATUS_FLOW = ["recebido", "preparando", "pronto", "concluido"];

const STATUS_META = {
  recebido:   { label: "Novo",       color: "#9A2B25", next: "preparando", nextLabel: "Iniciar preparo" },
  preparando: { label: "Preparando", color: "#E8542A", next: "pronto",     nextLabel: "Marcar como pronto" },
  pronto:     { label: "Pronto",     color: "#5B7B4F", next: "concluido",  nextLabel: "Entregar / concluir" },
  concluido:  { label: "Concluído",  color: "#7a7268", next: null,         nextLabel: null },
};

const fmt = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function minutesAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return diff < 1 ? "agora" : `${diff} min`;
}

export default function KDSApp() {
  const [orders, setOrders] = useState([]);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(Date.now()); // força re-render pra atualizar "X min atrás"

  // Ping visual do relógio a cada 20s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);

  // Carga inicial: busca pedidos ainda não concluídos
  const loadInitial = useCallback(async () => {
    try {
      const [recebido, preparando, pronto] = await Promise.all([
        fetch(`${API_URL}/api/orders?status=recebido`).then((r) => r.json()),
        fetch(`${API_URL}/api/orders?status=preparando`).then((r) => r.json()),
        fetch(`${API_URL}/api/orders?status=pronto`).then((r) => r.json()),
      ]);
      setOrders([...recebido, ...preparando, ...pronto]);
    } catch (e) {
      console.error("Falha ao carregar pedidos:", e);
    }
  }, []);

  useEffect(() => {
    loadInitial();

    const socket = io(API_URL);
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("order:new", (order) => {
      setOrders((prev) => [order, ...prev]);
      // Beep sonoro simples ao chegar pedido novo
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.frequency.value = 880;
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } catch (_) {}
    });

    socket.on("order:updated", (updated) => {
      setOrders((prev) =>
        updated.status === "concluido"
          ? prev.filter((o) => o.id !== updated.id)
          : prev.map((o) => (o.id === updated.id ? updated : o))
      );
    });

    return () => socket.disconnect();
  }, [loadInitial]);

  async function advanceStatus(order) {
    const meta = STATUS_META[order.status];
    if (!meta.next) return;
    try {
      const res = await fetch(`${API_URL}/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: meta.next }),
      });
      const updated = await res.json();
      setOrders((prev) =>
        updated.status === "concluido"
          ? prev.filter((o) => o.id !== updated.id)
          : prev.map((o) => (o.id === updated.id ? updated : o))
      );
    } catch (e) {
      console.error("Falha ao atualizar status:", e);
    }
  }

  const columns = ["recebido", "preparando", "pronto"];

  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        background: "#1C1917",
        minHeight: "680px",
        width: "100%",
        padding: "18px",
        boxSizing: "border-box",
        color: "#FBF3E7",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap');
        .kds-display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.02em; }
        .kds-mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes cardIn { from { opacity:0; transform: scale(0.96);} to { opacity:1; transform: scale(1);} }
        .kds-card { animation: cardIn 0.25s ease-out both; }
        .kds-scroll::-webkit-scrollbar { width: 5px; }
        .kds-scroll::-webkit-scrollbar-thumb { background: #ffffff22; border-radius: 4px; }
      `}</style>

      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <ChefHat size={26} color="#F4B93F" />
          <h1 className="kds-display" style={{ fontSize: "26px", margin: 0 }}>PAINEL DA COZINHA</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: connected ? "#5B7B4F" : "#9A2B25" }}>
          {connected ? <Wifi size={15} /> : <WifiOff size={15} />}
          {connected ? "Conectado" : "Desconectado"}
        </div>
      </div>

      {/* Colunas por status */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
        {columns.map((status) => {
          const meta = STATUS_META[status];
          const ordersInStatus = orders
            .filter((o) => o.status === status)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

          return (
            <div key={status} style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  background: `${meta.color}22`,
                  border: `1px solid ${meta.color}55`,
                  marginBottom: "10px",
                }}
              >
                <span className="kds-display" style={{ fontSize: "16px", color: meta.color }}>
                  {meta.label.toUpperCase()}
                </span>
                <span className="kds-mono" style={{ fontSize: "12px", opacity: 0.8 }}>
                  {ordersInStatus.length}
                </span>
              </div>

              <div className="kds-scroll" style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", maxHeight: "560px" }}>
                {ordersInStatus.length === 0 && (
                  <p style={{ fontSize: "11.5px", opacity: 0.4, textAlign: "center", marginTop: "20px" }}>
                    Nenhum pedido aqui
                  </p>
                )}
                {ordersInStatus.map((order) => (
                  <OrderCard key={order.id} order={order} meta={meta} onAdvance={() => advanceStatus(order)} now={now} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({ order, meta, onAdvance, now }) {
  const late = Date.now() - new Date(order.createdAt).getTime() > 10 * 60 * 1000 && order.status !== "pronto";

  return (
    <div
      className="kds-card"
      style={{
        background: "#252019",
        border: `1px solid ${late ? "#9A2B25" : "#3a352d"}`,
        borderRadius: "12px",
        padding: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="kds-mono" style={{ fontSize: "20px", fontWeight: 700, color: "#F4B93F" }}>
          #{order.orderNumber}
        </span>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: "999px",
            background: order.type === "aqui" ? "#5B7B4F33" : "#E8542A33",
            color: order.type === "aqui" ? "#5B7B4F" : "#E8542A",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <Utensils size={11} />
          {order.type === "aqui" ? "Comer aqui" : "Para levar"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", fontSize: "10.5px", color: late ? "#E8542A" : "#7a7268" }}>
        <Clock size={11} />
        {minutesAgo(order.createdAt)}
        {late && " — atrasado"}
      </div>

      <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
        {order.items.map((item, idx) => (
          <div key={idx} style={{ fontSize: "12.5px" }}>
            <span style={{ fontWeight: 700 }}>{item.qty}x</span> {item.name}
            {item.extras?.length > 0 && (
              <div style={{ fontSize: "10.5px", color: "#a89f8f", marginLeft: "16px" }}>
                + {item.extras.join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #3a352d" }}>
        <span className="kds-mono" style={{ fontSize: "12px", opacity: 0.7 }}>{fmt(order.total)}</span>
      </div>

      {meta.next && (
        <button
          onClick={onAdvance}
          style={{
            width: "100%",
            marginTop: "10px",
            background: meta.color,
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "9px",
            fontSize: "11.5px",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          {order.status === "pronto" ? <Bell size={13} /> : <CheckCircle2 size={13} />}
          {meta.nextLabel}
        </button>
      )}
    </div>
  );
}
