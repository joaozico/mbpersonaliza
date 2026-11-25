-- ==============================================================================
-- MB PERSONALIZA — MIGRATION ADITIVA 0001
-- Índices de desempenho e chaves estrangeiras (NOT VALID para preservar legado)
-- ==============================================================================

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_uid ON auth_sessions (user_uid);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON subcategories (category_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products (slug);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders (client_id);
CREATE INDEX IF NOT EXISTS idx_orders_code ON orders (code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (order_status);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes (client_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_id ON coupon_usages (coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_order_id ON coupon_usages (order_id);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_type_status ON financial_accounts (type, status);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_order_id ON financial_accounts (order_id);
CREATE INDEX IF NOT EXISTS idx_boletos_order_id ON boletos (order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_ts ON analytics_pageviews (timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_pageviews_session ON analytics_pageviews (session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_ts ON analytics_events (timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events (session_id);
CREATE INDEX IF NOT EXISTS idx_stricker_orders_stamp ON stricker_orders (order_stamp);

-- Integridade referencial segura (idempotente e não destrutiva)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_auth_sessions_user_uid') THEN
    ALTER TABLE auth_sessions
      ADD CONSTRAINT fk_auth_sessions_user_uid
      FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_subcategories_category_id') THEN
    ALTER TABLE subcategories
      ADD CONSTRAINT fk_subcategories_category_id
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_category_id') THEN
    ALTER TABLE products
      ADD CONSTRAINT fk_products_category_id
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_coupon_usages_coupon_id') THEN
    ALTER TABLE coupon_usages
      ADD CONSTRAINT fk_coupon_usages_coupon_id
      FOREIGN KEY (coupon_id) REFERENCES discount_coupons(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_coupon_send_history_coupon_id') THEN
    ALTER TABLE coupon_send_history
      ADD CONSTRAINT fk_coupon_send_history_coupon_id
      FOREIGN KEY (coupon_id) REFERENCES discount_coupons(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_stock_movements_product_id') THEN
    ALTER TABLE stock_movements
      ADD CONSTRAINT fk_stock_movements_product_id
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
