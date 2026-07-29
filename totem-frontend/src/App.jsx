import React, { useState, useEffect, useRef } from "react";
import {
  Flame, Plus, Minus, X, ShoppingBag, Check,
  UtensilsCrossed, CupSoda, IceCreamCone, Sandwich,
  CreditCard, QrCode, ArrowLeft, Clock, AlertTriangle
} from "lucide-react";

// ---------------------------------------------------------------------------
// Aponte para o endereço da sua API. Em produção, isso normalmente vem de
// uma variável de ambiente (import.meta.env.VITE_API_URL), mas deixei fixo
// aqui pra ficar simples de rodar local.
// ---------------------------------------------------------------------------
const API_URL = "http://localhost:3001";

// Ícone por categoria — o backend só manda o id/label, o visual fica no front
const CATEGORY_ICONS = {
  burgers: Sandwich,
  sides: UtensilsCrossed,
  drinks: CupSoda,
  desserts: IceCreamCone,
};
const CATEGORY_COLORS = ["#E8542A", "#9A2B25", "#F4B93F", "#5B7B4F"];

const fmt = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function KioskApp() {
  const [screen, setScreen] = useState("idle"); // idle | menu | checkout | paying | done | error
  const [activeCat, setActiveCat] = useState(null);
  const [cart, setCart] = useState([]);
  const [customizing, setCustomizing] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderType, setOrderType] = useState(null);
  const [payMethod, setPayMethod] = useState(null);
  const [orderNumber, setOrderNumber] = useState(null);
  const idleTimer = useRef(null);

  // Dados vindos da API
  const [menu, setMenu] = useState({ categories: [], items: [] });
  const [extras, setExtras] = useState([]);
  const [loadError, setLoadError] = useState(null);

  // Carrega cardápio e adicionais do backend ao abrir o totem
  useEffect(() => {
    async function loadMenu() {
      try {
        const [menuRes, extrasRes] = await Promise.all([
          fetch(`${API_URL}/api/menu`),
          fetch(`${API_URL}/api/menu/extras`),
        ]);
        if (!menuRes.ok || !extrasRes.ok) throw new Error("Falha ao carregar cardápio");
        const menuData = await menuRes.json();
        const extrasData = await extrasRes.json();
        setMenu(menuData);
        setExtras(extrasData);
        setActiveCat(menuData.categories[0]?.id ?? null);
      } catch (err) {
        setLoadError("Não foi possível conectar à API. Verifique se o backend está rodando em " + API_URL);
      }
    }
    loadMenu();
  }, []);

  useEffect(() => {
    if (screen === "done") {
      idleTimer.current = setTimeout(() => resetKiosk(), 8000);
      return () => clearTimeout(idleTimer.current);
    }
  }, [screen]);

  function resetKiosk() {
    setCart([]);
    setOrderType(null);
    setPayMethod(null);
    setOrderNumber(null);
    setCartOpen(false);
    setActiveCat(menu.categories[0]?.id ?? null);
    setScreen("idle");
  }

  function addToCart(item, qty, selectedExtras) {
    const extraTotal = selectedExtras.reduce(
      (s, id) => s + (extras.find((e) => e.id === id)?.price || 0),
      0
    );
    setCart((c) => [
      ...c,
      { uid: Date.now(), ...item, qty, extras: selectedExtras, unitPrice: item.price + extraTotal },
    ]);
    setCustomizing(null);
    setCartOpen(true);
  }

  function removeFromCart(uid) {
    setCart((c) => c.filter((i) => i.uid !== uid));
  }

  function changeQty(uid, delta) {
    setCart((c) => c.map((i) => (i.uid === uid ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  }

  const total = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const itemCount = cart.reduce((s, i) => s + i.qty, 0);

  // Envia o pedido de verdade pro backend (POST /api/orders)
  async function confirmOrder() {
    setScreen("paying");
    try {
      const res = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: orderType,
          paymentMethod: payMethod,
          items: cart.map((i) => ({
            menuItemId: i.id,
            name: i.name,
            qty: i.qty,
            unitPrice: i.unitPrice,
            extras: i.extras,
          })),
        }),
      });
      if (!res.ok) throw new Error("Pedido recusado pela API");
      const order = await res.json();
      // Pequeno delay artificial só pra dar sensação de "processando pagamento"
      setTimeout(() => {
        setOrderNumber(order.orderNumber);
        setScreen("done");
      }, 900);
    } catch (err) {
      setScreen("checkout");
      alert("Não foi possível enviar o pedido. Verifique a conexão com o backend e tente novamente.");
    }
  }

  if (loadError) {
    return (
      <div style={frameOuter}>
        <div style={{ ...frameInner, alignItems: "center", justifyContent: "center", padding: "32px", textAlign: "center", color: "#FBF3E7" }}>
          <AlertTriangle size={40} color="#E8542A" />
          <p style={{ fontSize: "13px", marginTop: "14px", lineHeight: 1.5 }}>{loadError}</p>
        </div>
      </div>
    );
  }

  if (!activeCat) {
    return (
      <div style={frameOuter}>
        <div style={{ ...frameInner, alignItems: "center", justifyContent: "center", color: "#FBF3E7", fontSize: "13px" }}>
          Carregando cardápio...
        </div>
      </div>
    );
  }

  return (
    <div style={frameOuter}>
      <style>{GLOBAL_STYLES}</style>
      <div style={frameInner}>
        {screen === "idle" && <IdleScreen onStart={() => setScreen("menu")} />}

        {screen === "menu" && (
          <MenuScreen
            menu={menu}
            activeCat={activeCat}
            setActiveCat={setActiveCat}
            onItemTap={(item) => setCustomizing(item)}
            itemCount={itemCount}
            total={total}
            onOpenCart={() => setCartOpen(true)}
          />
        )}

        {screen === "checkout" && (
          <CheckoutScreen
            total={total}
            orderType={orderType}
            setOrderType={setOrderType}
            payMethod={payMethod}
            setPayMethod={setPayMethod}
            onBack={() => setScreen("menu")}
            onConfirm={confirmOrder}
          />
        )}

        {screen === "paying" && <PayingScreen />}

        {screen === "done" && (
          <DoneScreen orderNumber={orderNumber} orderType={orderType} onReset={resetKiosk} />
        )}

        {cartOpen && screen === "menu" && (
          <CartDrawer
            cart={cart}
            extras={extras}
            total={total}
            onClose={() => setCartOpen(false)}
            onChangeQty={changeQty}
            onRemove={removeFromCart}
            onCheckout={() => {
              setCartOpen(false);
              setScreen("checkout");
            }}
          />
        )}

        {customizing && (
          <CustomizeModal item={customizing} extras={extras} onCancel={() => setCustomizing(null)} onAdd={addToCart} />
        )}
      </div>
    </div>
  );
}

const frameOuter = {
  fontFamily: "'DM Sans', sans-serif",
  background: "#1C1917",
  width: "100%",
  minHeight: "680px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "18px",
  boxSizing: "border-box",
};

const frameInner = {
  width: "420px",
  height: "680px",
  borderRadius: "28px",
  background: "#FBF3E7",
  border: "10px solid #1C1917",
  boxShadow: "0 30px 60px -20px #00000080, inset 0 0 0 2px #33302c",
  overflow: "hidden",
  position: "relative",
  display: "flex",
  flexDirection: "column",
};

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@500;700&display=swap');
  .kiosk-display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.02em; }
  .kiosk-mono { font-family: 'JetBrains Mono', monospace; }
  .kiosk-scroll::-webkit-scrollbar { width: 6px; }
  .kiosk-scroll::-webkit-scrollbar-thumb { background: #E8542A44; border-radius: 4px; }
  .grill-stripe { background-image: repeating-linear-gradient(135deg, #00000012 0 6px, transparent 6px 12px); }
  @keyframes pulseGlow { 0%,100% { opacity:1 } 50% { opacity:.55 } }
  .idle-pulse { animation: pulseGlow 2.2s ease-in-out infinite; }
  @keyframes riseIn { from { opacity:0; transform: translateY(14px);} to { opacity:1; transform: translateY(0);} }
  .rise-in { animation: riseIn 0.35s ease-out both; }
`;

function IdleScreen({ onStart }) {
  return (
    <div
      onClick={onStart}
      style={{
        flex: 1,
        background: "linear-gradient(160deg, #1C1917 0%, #2b2420 60%, #1C1917 100%)",
        color: "#FBF3E7",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        textAlign: "center",
        padding: "32px",
      }}
    >
      <Flame size={54} color="#E8542A" />
      <h1 className="kiosk-display" style={{ fontSize: "54px", margin: "12px 0 0", lineHeight: 1 }}>
        BRASA<span style={{ color: "#E8542A" }}>BURGER</span>
      </h1>
      <p style={{ opacity: 0.7, marginTop: "8px", fontSize: "14px" }}>Smash burgers feitos na hora</p>
      <div
        className="idle-pulse"
        style={{
          marginTop: "48px",
          border: "2px solid #F4B93F",
          color: "#F4B93F",
          padding: "14px 28px",
          borderRadius: "999px",
          fontSize: "15px",
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        TOQUE PARA COMEÇAR
      </div>
    </div>
  );
}

function MenuScreen({ menu, activeCat, setActiveCat, onItemTap, itemCount, total, onOpenCart }) {
  const items = menu.items.filter((m) => m.category === activeCat);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ background: "#1C1917", color: "#FBF3E7", padding: "16px 18px 12px" }}>
        <h2 className="kiosk-display" style={{ fontSize: "26px", margin: 0 }}>FAÇA SEU PEDIDO</h2>
      </div>

      <div className="grill-stripe" style={{ display: "flex", gap: "6px", padding: "10px 12px", background: "#F4B93F" }}>
        {menu.categories.map((c) => {
          const Icon = CATEGORY_ICONS[c.id] || UtensilsCrossed;
          const active = c.id === activeCat;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                padding: "8px 4px",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                background: active ? "#1C1917" : "transparent",
                color: active ? "#F4B93F" : "#1C1917",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "10px",
                fontWeight: 700,
              }}
            >
              <Icon size={16} />
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="kiosk-scroll" style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {items.map((item, idx) => (
          <button
            key={item.id}
            onClick={() => onItemTap(item)}
            className="rise-in"
            style={{ display: "flex", alignItems: "center", gap: "12px", background: "#fff", border: "1px solid #eee0cc", borderRadius: "16px", padding: "10px", cursor: "pointer", textAlign: "left" }}
          >
            <div style={{ width: "58px", height: "58px", borderRadius: "12px", background: CATEGORY_COLORS[idx % CATEGORY_COLORS.length], flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sandwich size={26} color="#fff" opacity={0.85} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "14.5px", color: "#1C1917" }}>{item.name}</div>
              <div style={{ fontSize: "11.5px", color: "#7a7268", marginTop: "2px", lineHeight: 1.3 }}>{item.description}</div>
              <div className="kiosk-mono" style={{ fontSize: "13px", color: "#9A2B25", marginTop: "5px", fontWeight: 700 }}>{fmt(item.price)}</div>
            </div>
            <Plus size={18} color="#E8542A" />
          </button>
        ))}
      </div>

      {itemCount > 0 && (
        <button
          onClick={onOpenCart}
          style={{ margin: "0 14px 14px", background: "#9A2B25", color: "#fff", border: "none", borderRadius: "14px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "13px" }}>
            <ShoppingBag size={17} />
            {itemCount} {itemCount === 1 ? "item" : "itens"}
          </span>
          <span className="kiosk-mono" style={{ fontWeight: 700, fontSize: "14px" }}>{fmt(total)}</span>
        </button>
      )}
    </div>
  );
}

function CustomizeModal({ item, extras, onCancel, onAdd }) {
  const [qty, setQty] = useState(1);
  const [selected, setSelected] = useState([]);

  function toggleExtra(id) {
    setSelected((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  }

  const extraTotal = selected.reduce((s, id) => s + (extras.find((e) => e.id === id)?.price || 0), 0);
  const lineTotal = (item.price + extraTotal) * qty;

  return (
    <div style={{ position: "absolute", inset: 0, background: "#00000066", display: "flex", alignItems: "flex-end", zIndex: 20 }}>
      <div className="rise-in" style={{ background: "#FBF3E7", width: "100%", borderRadius: "22px 22px 0 0", padding: "18px", maxHeight: "88%", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ width: "70px", height: "70px", borderRadius: "14px", background: "#E8542A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sandwich size={30} color="#fff" opacity={0.85} />
          </div>
          <button onClick={onCancel} style={{ border: "none", background: "#eee0cc", borderRadius: "999px", width: "30px", height: "30px", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <h3 className="kiosk-display" style={{ fontSize: "24px", margin: "12px 0 2px", color: "#1C1917" }}>{item.name}</h3>
        <p style={{ fontSize: "12.5px", color: "#7a7268", margin: 0 }}>{item.description}</p>

        <div style={{ marginTop: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#9A2B25", letterSpacing: "0.04em", marginBottom: "8px" }}>ADICIONAIS</div>
          {extras.map((ex) => (
            <label key={ex.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px", borderBottom: "1px solid #eee0cc", fontSize: "13px", cursor: "pointer" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="checkbox" checked={selected.includes(ex.id)} onChange={() => toggleExtra(ex.id)} style={{ width: "16px", height: "16px", accentColor: "#E8542A" }} />
                {ex.label}
              </span>
              {ex.price > 0 && <span className="kiosk-mono" style={{ color: "#7a7268" }}>+{fmt(ex.price)}</span>}
            </label>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={qtyBtnStyle}><Minus size={16} /></button>
            <span className="kiosk-mono" style={{ fontSize: "16px", fontWeight: 700, minWidth: "16px", textAlign: "center" }}>{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} style={qtyBtnStyle}><Plus size={16} /></button>
          </div>
        </div>

        <button
          onClick={() => onAdd(item, qty, selected)}
          style={{ width: "100%", marginTop: "18px", background: "#E8542A", color: "#fff", border: "none", borderRadius: "14px", fontWeight: 700, fontSize: "14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 20px" }}
        >
          <span>Adicionar ao pedido</span>
          <span className="kiosk-mono">{fmt(lineTotal)}</span>
        </button>
      </div>
    </div>
  );
}

const qtyBtnStyle = { width: "34px", height: "34px", borderRadius: "999px", border: "1px solid #ddd0b8", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };

function CartDrawer({ cart, extras, total, onClose, onChangeQty, onRemove, onCheckout }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#00000066", display: "flex", alignItems: "flex-end", zIndex: 15 }}>
      <div className="rise-in" style={{ background: "#FBF3E7", width: "100%", borderRadius: "22px 22px 0 0", padding: "18px", maxHeight: "82%", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="kiosk-display" style={{ fontSize: "22px", margin: 0, color: "#1C1917" }}>SEU PEDIDO</h3>
          <button onClick={onClose} style={{ border: "none", background: "#eee0cc", borderRadius: "999px", width: "30px", height: "30px", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <div className="kiosk-scroll" style={{ overflowY: "auto", marginTop: "12px", flex: 1 }}>
          {cart.length === 0 && <p style={{ color: "#7a7268", fontSize: "13px" }}>Seu carrinho está vazio.</p>}
          {cart.map((i) => (
            <div key={i.uid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #eee0cc" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#1C1917" }}>{i.name}</div>
                {i.extras.length > 0 && (
                  <div style={{ fontSize: "10.5px", color: "#7a7268" }}>
                    + {i.extras.map((id) => extras.find((e) => e.id === id)?.label).join(", ")}
                  </div>
                )}
                <button onClick={() => onRemove(i.uid)} style={{ border: "none", background: "none", color: "#9A2B25", fontSize: "11px", padding: 0, marginTop: "4px", cursor: "pointer" }}>Remover</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button onClick={() => onChangeQty(i.uid, -1)} style={{ ...qtyBtnStyle, width: "26px", height: "26px" }}><Minus size={12} /></button>
                <span className="kiosk-mono" style={{ fontSize: "13px", minWidth: "12px", textAlign: "center" }}>{i.qty}</span>
                <button onClick={() => onChangeQty(i.uid, 1)} style={{ ...qtyBtnStyle, width: "26px", height: "26px" }}><Plus size={12} /></button>
              </div>
              <span className="kiosk-mono" style={{ fontSize: "13px", fontWeight: 700, marginLeft: "10px", width: "62px", textAlign: "right" }}>{fmt(i.unitPrice * i.qty)}</span>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0 8px", fontSize: "15px", fontWeight: 700, color: "#1C1917" }}>
              <span>Total</span>
              <span className="kiosk-mono">{fmt(total)}</span>
            </div>
            <button onClick={onCheckout} style={{ background: "#9A2B25", color: "#fff", border: "none", borderRadius: "14px", padding: "15px", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
              Finalizar pedido
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CheckoutScreen({ total, orderType, setOrderType, payMethod, setPayMethod, onBack, onConfirm }) {
  const canConfirm = orderType && payMethod;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#FBF3E7" }}>
      <div style={{ background: "#1C1917", color: "#FBF3E7", padding: "16px 18px", display: "flex", alignItems: "center", gap: "10px" }}>
        <button onClick={onBack} style={{ border: "none", background: "none", color: "#FBF3E7", cursor: "pointer" }}>
          <ArrowLeft size={20} />
        </button>
        <h2 className="kiosk-display" style={{ fontSize: "22px", margin: 0 }}>FINALIZAR</h2>
      </div>

      <div style={{ padding: "20px", flex: 1, overflowY: "auto" }} className="kiosk-scroll">
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#9A2B25", letterSpacing: "0.04em", marginBottom: "10px" }}>ONDE VAI CONSUMIR?</div>
        <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
          {[{ id: "aqui", label: "Comer aqui" }, { id: "levar", label: "Para levar" }].map((o) => (
            <button key={o.id} onClick={() => setOrderType(o.id)} style={{ flex: 1, padding: "16px 8px", borderRadius: "14px", border: orderType === o.id ? "2px solid #E8542A" : "1px solid #ddd0b8", background: orderType === o.id ? "#E8542A18" : "#fff", fontWeight: 700, fontSize: "13px", color: "#1C1917", cursor: "pointer" }}>
              {o.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: "11px", fontWeight: 700, color: "#9A2B25", letterSpacing: "0.04em", marginBottom: "10px" }}>FORMA DE PAGAMENTO</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[{ id: "cartao", label: "Cartão de crédito/débito", icon: CreditCard }, { id: "pix", label: "Pix", icon: QrCode }].map((p) => {
            const Icon = p.icon;
            return (
              <button key={p.id} onClick={() => setPayMethod(p.id)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px", borderRadius: "14px", border: payMethod === p.id ? "2px solid #E8542A" : "1px solid #ddd0b8", background: payMethod === p.id ? "#E8542A18" : "#fff", fontWeight: 700, fontSize: "13px", color: "#1C1917", cursor: "pointer", textAlign: "left" }}>
                <Icon size={20} color="#E8542A" />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "16px 20px", borderTop: "1px solid #eee0cc" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "15px", fontWeight: 700, color: "#1C1917" }}>
          <span>Total a pagar</span>
          <span className="kiosk-mono">{fmt(total)}</span>
        </div>
        <button disabled={!canConfirm} onClick={onConfirm} style={{ width: "100%", background: canConfirm ? "#9A2B25" : "#ddd0b8", color: "#fff", border: "none", borderRadius: "14px", padding: "15px", fontWeight: 700, fontSize: "14px", cursor: canConfirm ? "pointer" : "not-allowed" }}>
          Confirmar e pagar
        </button>
      </div>
    </div>
  );
}

function PayingScreen() {
  return (
    <div style={{ flex: 1, background: "#1C1917", color: "#FBF3E7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
      <div className="idle-pulse">
        <CreditCard size={48} color="#F4B93F" />
      </div>
      <p style={{ fontSize: "14px", opacity: 0.8 }}>Processando pagamento...</p>
    </div>
  );
}

function DoneScreen({ orderNumber, orderType, onReset }) {
  return (
    <div style={{ flex: 1, background: "#FBF3E7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center" }}>
      <div style={{ width: "64px", height: "64px", borderRadius: "999px", background: "#5B7B4F", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Check size={30} color="#fff" />
      </div>
      <h2 className="kiosk-display" style={{ fontSize: "24px", margin: "16px 0 4px", color: "#1C1917" }}>PEDIDO CONFIRMADO!</h2>
      <p style={{ fontSize: "13px", color: "#7a7268", margin: "0 0 20px" }}>
        {orderType === "aqui" ? "Vamos te chamar quando estiver pronto." : "Retire no balcão quando chamado."}
      </p>

      <div style={{ background: "#fff", border: "2px dashed #E8542A", borderRadius: "16px", padding: "20px 32px" }}>
        <div style={{ fontSize: "10.5px", letterSpacing: "0.08em", color: "#9A2B25", fontWeight: 700 }}>SEU NÚMERO</div>
        <div className="kiosk-mono" style={{ fontSize: "46px", fontWeight: 700, color: "#1C1917", lineHeight: 1.1 }}>{orderNumber}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "20px", color: "#7a7268", fontSize: "11.5px" }}>
        <Clock size={13} />
        Tempo estimado: 8–12 min
      </div>

      <button onClick={onReset} style={{ marginTop: "28px", border: "none", background: "none", color: "#9A2B25", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
        Novo pedido
      </button>
    </div>
  );
}
