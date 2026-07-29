import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, "..", "data", "db.json");

const SEED = {
  categories: [
    { id: "burgers", label: "Burgers" },
    { id: "sides", label: "Acompanhamentos" },
    { id: "drinks", label: "Bebidas" },
    { id: "desserts", label: "Sobremesas" },
  ],
  menuItems: [
    { id: 1, category: "burgers", name: "Smash Clássico", description: "2 carnes smash, queijo prato, picles, molho da casa", price: 24.9, active: true },
    { id: 2, category: "burgers", name: "Bacon Duplo", description: "2 carnes, bacon crocante, cheddar, cebola caramelizada", price: 29.9, active: true },
    { id: 3, category: "burgers", name: "Frango Crispy", description: "Frango empanado, maionese picante, alface, tomate", price: 26.9, active: true },
    { id: 4, category: "burgers", name: "Veggie", description: "Blend de grão-de-bico e cogumelos, queijo, rúcula", price: 27.9, active: true },
    { id: 5, category: "sides", name: "Batata Frita", description: "Porção generosa, sal na medida certa", price: 12.9, active: true },
    { id: 6, category: "sides", name: "Onion Rings", description: "Anéis de cebola empanados e crocantes", price: 14.9, active: true },
    { id: 7, category: "sides", name: "Nuggets (10un)", description: "Frango empanado, molho barbecue incluso", price: 16.9, active: true },
    { id: 8, category: "drinks", name: "Refrigerante Lata", description: "Coca, Guaraná ou Zero — 350ml", price: 6.9, active: true },
    { id: 9, category: "drinks", name: "Suco Natural", description: "Laranja, limão ou maracujá — 400ml", price: 8.9, active: true },
    { id: 10, category: "drinks", name: "Milkshake", description: "Chocolate, morango ou baunilha — 400ml", price: 15.9, active: true },
    { id: 11, category: "desserts", name: "Brownie c/ Sorvete", description: "Brownie quente com bola de sorvete de creme", price: 13.9, active: true },
    { id: 12, category: "desserts", name: "Petit Gateau", description: "Recheio de chocolate meio amargo derretido", price: 15.9, active: true },
  ],
  extras: [
    { id: "cheese", label: "Queijo extra", price: 4.0 },
    { id: "bacon", label: "Bacon extra", price: 6.0 },
    { id: "egg", label: "Ovo", price: 3.5 },
    { id: "nomayo", label: "Sem maionese", price: 0 },
    { id: "nopickle", label: "Sem picles", price: 0 },
  ],
  orders: [],
  nextOrderNumber: 100,
};

function load() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(SEED, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

export const db = {
  getMenu() {
    const data = load();
    return { categories: data.categories, items: data.menuItems.filter((i) => i.active) };
  },

  getExtras() {
    return load().extras;
  },

  createOrder({ storeId = "default", type, paymentMethod, items }) {
    const data = load();
    const orderNumber = data.nextOrderNumber;
    data.nextOrderNumber += 1;

    const rawTotal = items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
    const total = Math.round(rawTotal * 100) / 100;

    const order = {
      id: `ord_${Date.now()}_${orderNumber}`,
      orderNumber,
      storeId,
      type, // "aqui" | "levar"
      paymentMethod, // "cartao" | "pix"
      status: "recebido", // recebido -> preparando -> pronto -> concluido
      items,
      total,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    data.orders.push(order);
    save(data);
    return order;
  },

  listOrders({ status, storeId } = {}) {
    let orders = load().orders;
    if (status) orders = orders.filter((o) => o.status === status);
    if (storeId) orders = orders.filter((o) => o.storeId === storeId);
    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getOrder(id) {
    return load().orders.find((o) => o.id === id) || null;
  },

  updateOrderStatus(id, status) {
    const data = load();
    const order = data.orders.find((o) => o.id === id);
    if (!order) return null;
    order.status = status;
    order.updatedAt = new Date().toISOString();
    save(data);
    return order;
  },
};
