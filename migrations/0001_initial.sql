PRAGMA foreign_keys = ON;
CREATE TABLE products (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('Оборудование','Расходные материалы','Услуги')),
  price INTEGER NOT NULL CHECK(price >= 0), images TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE orders (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, request_key TEXT NOT NULL,
  customer_name TEXT NOT NULL, phone TEXT NOT NULL, username TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL, total INTEGER NOT NULL CHECK(total >= 0),
  status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL,
  UNIQUE(user_id,request_key)
);
CREATE INDEX orders_user_created ON orders(user_id,created_at DESC);
CREATE TABLE outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, entity_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, synced_version INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
  last_error TEXT, UNIQUE(entity,entity_id)
);
CREATE TABLE leases (name TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE media (key TEXT PRIMARY KEY, created_at TEXT NOT NULL);
