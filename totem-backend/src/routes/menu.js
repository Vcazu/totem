import { Router } from "express";
import { db } from "../db.js";

export const menuRouter = Router();

// GET /api/menu -> categorias + itens (o que o totem carrega na tela de cardápio)
menuRouter.get("/", (req, res) => {
  res.json(db.getMenu());
});

// GET /api/menu/extras -> lista de adicionais disponíveis para customização
menuRouter.get("/extras", (req, res) => {
  res.json(db.getExtras());
});
