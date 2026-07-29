
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,          -- ex: 'burgers'
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE menu_items (
  id SERIAL PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE extras (
  id TEXT PRIMARY KEY,          -- ex: 'cheese'
  label TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  order_number INT NOT NULL,             -- número curto mostrado ao cliente (reinicia por dia, se quiser)
  type TEXT NOT NULL CHECK (type IN ('aqui', 'levar')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cartao', 'pix')),
  status TEXT NOT NULL DEFAULT 'recebido'
    CHECK (status IN ('recebido', 'preparando', 'pronto', 'concluido')),
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INT NOT NULL REFERENCES menu_items(id),
  name TEXT NOT NULL,           -- snapshot do nome no momento do pedido
  qty INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  extras JSONB NOT NULL DEFAULT '[]'  -- ex: [{"id":"cheese","label":"Queijo extra","price":4.0}]
);

CREATE INDEX idx_orders_store_status ON orders(store_id, status);
CREATE INDEX idx_menu_items_store_category ON menu_items(store_id, category_id);
