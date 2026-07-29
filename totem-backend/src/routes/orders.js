import { Router } from "express";
import { db } from "../db.js";

export const ordersRouter = Router();

const VALID_TYPES = ["aqui", "levar"];
const VALID_PAYMENTS = ["cartao", "pix"];
const VALID_STATUSES = ["recebido", "preparando", "pronto", "concluido"];

// POST /api/orders -> criado pelo totem quando o cliente confirma o pagamento
// body: { type, paymentMethod, items: [{ menuItemId, name, qty, unitPrice, extras: [] }] }
ordersRouter.post("/", (req, res) => {
  const { type, paymentMethod, items, storeId } = req.body;

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: "type deve ser 'aqui' ou 'levar'" });
  }
  if (!VALID_PAYMENTS.includes(paymentMethod)) {
    return res.status(400).json({ error: "paymentMethod deve ser 'cartao' ou 'pix'" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items não pode ser vazio" });
  }

  const order = db.createOrder({ storeId, type, paymentMethod, items });

  // Notifica o painel da cozinha (KDS) em tempo real
  req.app.get("io").emit("order:new", order);

  res.status(201).json(order);
});

// GET /api/orders?status=recebido -> usado pelo KDS para listar a fila
ordersRouter.get("/", (req, res) => {
  const { status, storeId } = req.query;
  res.json(db.listOrders({ status, storeId }));
});

// GET /api/orders/:id -> consulta de um pedido específico (ex: tela de status pro cliente)
ordersRouter.get("/:id", (req, res) => {
  const order = db.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
  res.json(order);
});

// PATCH /api/orders/:id/status -> usado pelo KDS para avançar o pedido (recebido -> preparando -> pronto -> concluido)
ordersRouter.patch("/:id/status", (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status deve ser um de: ${VALID_STATUSES.join(", ")}` });
  }

  const order = db.updateOrderStatus(req.params.id, status);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

  // Notifica quem estiver ouvindo (KDS, tela de senha na parede, etc.)
  req.app.get("io").emit("order:updated", order);

  res.json(order);
});
