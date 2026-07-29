import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import { menuRouter } from "./routes/menu.js";
import { ordersRouter } from "./routes/orders.js";

const app = express();
const httpServer = createServer(app);

// Socket.io: usado para avisar o painel da cozinha (KDS) em tempo real
// quando um pedido novo chega ou muda de status, sem precisar dar refresh.
const io = new Server(httpServer, {
  cors: { origin: "*" }, // em produção, restrinja ao domínio do seu painel/totem
});
app.set("io", io);

io.on("connection", (socket) => {
  console.log(`[socket] cliente conectado: ${socket.id}`);
  socket.on("disconnect", () => console.log(`[socket] cliente saiu: ${socket.id}`));
});

app.use(cors());
app.use(express.json());

// Log simples de cada requisição (útil pra depurar o totem em campo)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/menu", menuRouter);
app.use("/api/orders", ordersRouter);

app.use((req, res) => res.status(404).json({ error: "Rota não encontrada" }));

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`API do totem rodando em http://localhost:${PORT}`);
});
