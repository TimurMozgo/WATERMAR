ALTER TABLE orders ADD COLUMN rejection_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN reviewed_by TEXT;
ALTER TABLE orders ADD COLUMN reviewed_at TEXT;
UPDATE orders SET status=CASE status WHEN 'new' THEN 'pending' WHEN 'processing' THEN 'pending' WHEN 'completed' THEN 'confirmed' WHEN 'cancelled' THEN 'rejected' ELSE status END;
CREATE TABLE notifications (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id TEXT NOT NULL REFERENCES orders(id), recipient TEXT NOT NULL,
 event TEXT NOT NULL, payload TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt INTEGER NOT NULL DEFAULT 0, last_error TEXT, message_id INTEGER,
 UNIQUE(order_id,recipient,event)
);
CREATE INDEX notifications_pending ON notifications(state,next_attempt,id);
CREATE INDEX orders_status_created ON orders(status,created_at DESC);
CREATE TRIGGER order_received_notifications AFTER INSERT ON orders BEGIN
 INSERT INTO notifications(order_id,recipient,event,payload)
 SELECT NEW.id,recipient,event,json_object('code',NEW.code,'customer_name',NEW.customer_name,'phone',NEW.phone,'user_id',NEW.user_id,'username',NEW.username,'items',NEW.items,'total',NEW.total)
 FROM (SELECT NEW.user_id AS recipient,'received' AS event UNION ALL SELECT '394814448','owner_new' UNION ALL SELECT '6088315974','owner_new');
END;
CREATE TRIGGER order_decision_notifications AFTER UPDATE OF status ON orders WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO notifications(order_id,recipient,event,payload) VALUES(NEW.id,NEW.user_id,NEW.status,json_object('code',NEW.code,'total',NEW.total,'rejection_reason',NEW.rejection_reason));
 INSERT INTO outbox(entity,entity_id) VALUES('order',NEW.id) ON CONFLICT(entity,entity_id) DO UPDATE SET version=version+1,next_attempt=0;
END;
CREATE TRIGGER order_status_insert BEFORE INSERT ON orders WHEN NEW.status<>'pending' BEGIN SELECT RAISE(ABORT,'New orders must be pending'); END;
CREATE TRIGGER order_status_update BEFORE UPDATE OF status ON orders WHEN OLD.status<>NEW.status AND (OLD.status<>'pending' OR NEW.status NOT IN ('confirmed','rejected') OR (NEW.status='rejected' AND length(trim(NEW.rejection_reason))=0)) BEGIN SELECT RAISE(ABORT,'Invalid order decision'); END;
INSERT INTO outbox(entity,entity_id) SELECT 'order',id FROM orders WHERE 1 ON CONFLICT(entity,entity_id) DO UPDATE SET version=version+1,next_attempt=0;
