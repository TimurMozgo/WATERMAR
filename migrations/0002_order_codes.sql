ALTER TABLE orders ADD COLUMN code INTEGER;
UPDATE orders SET code = 99999 + (
  SELECT position FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at,id) AS position FROM orders
  ) numbered WHERE numbered.id = orders.id
);
CREATE UNIQUE INDEX orders_unique_code ON orders(code);
CREATE TABLE order_sequence (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  value INTEGER NOT NULL CHECK(value BETWEEN 99999 AND 999999)
);
INSERT INTO order_sequence(singleton,value) SELECT 1,COALESCE(MAX(code),99999) FROM orders;
CREATE TRIGGER orders_code_required BEFORE INSERT ON orders
WHEN NEW.code IS NULL OR NEW.code < 100000 OR NEW.code > 999999
BEGIN SELECT RAISE(ABORT,'Six-digit order code required'); END;
CREATE TRIGGER orders_code_immutable BEFORE UPDATE OF code ON orders
WHEN NEW.code IS NOT OLD.code
BEGIN SELECT RAISE(ABORT,'Order code is immutable'); END;
INSERT INTO outbox(entity,entity_id)
SELECT 'order',id FROM orders WHERE 1
ON CONFLICT(entity,entity_id) DO UPDATE SET version=version+1,next_attempt=0;
