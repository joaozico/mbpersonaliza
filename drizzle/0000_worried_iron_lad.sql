CREATE TABLE "analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" text NOT NULL,
	"session_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"event_name" text NOT NULL,
	"category" text DEFAULT 'Interação',
	"label" text DEFAULT '',
	"path" text DEFAULT '/',
	"value" double precision,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analytics_pageviews" (
	"id" text PRIMARY KEY NOT NULL,
	"timestamp" text NOT NULL,
	"session_id" text NOT NULL,
	"visitor_id" text NOT NULL,
	"path" text NOT NULL,
	"title" text DEFAULT '',
	"source" text DEFAULT 'direto',
	"device" text DEFAULT 'computador',
	"browser" text DEFAULT 'Chrome',
	"os" text DEFAULT 'Windows',
	"country" text DEFAULT 'Brasil',
	"state" text DEFAULT 'SP',
	"city" text DEFAULT 'São Paulo',
	"duration_seconds" integer DEFAULT 15,
	"is_new_visitor" boolean DEFAULT false,
	"data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analytics_realtime" (
	"session_id" text PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"last_active" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app_operation_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"module" text NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"actor_id" text,
	"actor_role" text,
	"action" text NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_uid" text NOT NULL,
	"role" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"user_agent" text DEFAULT '',
	"ip" text DEFAULT '',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "backups" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"size_formatted" text NOT NULL,
	"checksum" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"counts" jsonb,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"bank_name" text DEFAULT '',
	"agency" text DEFAULT '',
	"account_number" text DEFAULT '',
	"type" text DEFAULT 'corrente' NOT NULL,
	"initial_balance" double precision DEFAULT 0 NOT NULL,
	"current_balance" double precision DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "boletos" (
	"id" text PRIMARY KEY NOT NULL,
	"nosso_numero" text NOT NULL,
	"numero_documento" text NOT NULL,
	"order_id" text NOT NULL,
	"quote_id" text,
	"financial_account_id" text,
	"tipo_cobranca" text NOT NULL,
	"status" text DEFAULT 'emitido' NOT NULL,
	"valor" double precision NOT NULL,
	"data_vencimento" text NOT NULL,
	"data_emissao" text NOT NULL,
	"data_pagamento" text,
	"linha_digitavel" text NOT NULL,
	"codigo_barras" text NOT NULL,
	"banco_codigo" text NOT NULL,
	"banco_nome" text NOT NULL,
	"sacado_nome" text NOT NULL,
	"sacado_documento" text NOT NULL,
	"parcela_atual" integer,
	"total_parcelas" integer,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cash_register_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"register_number" integer DEFAULT 1 NOT NULL,
	"register_name" text DEFAULT 'Caixa Balcão 01' NOT NULL,
	"operator_id" text NOT NULL,
	"operator_name" text NOT NULL,
	"status" text DEFAULT 'aberto' NOT NULL,
	"initial_fund" double precision DEFAULT 0 NOT NULL,
	"expected_cash" double precision DEFAULT 0 NOT NULL,
	"actual_cash" double precision,
	"total_sales_amount" double precision DEFAULT 0,
	"raw_data" jsonb NOT NULL,
	"opened_at" text,
	"closed_at" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '',
	"image" text DEFAULT '',
	"icon" text DEFAULT '',
	"order_index" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cost_centers" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cost_composition_sheets" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"product_name" text NOT NULL,
	"category" text NOT NULL,
	"total_unit_cost" double precision DEFAULT 0 NOT NULL,
	"suggested_unit_price" double precision DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cost_indirect_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"monthly_amount" double precision DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cost_labor_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"effective_hourly_rate" double precision DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cost_machines" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"total_machine_cost_per_hour" double precision DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cost_pricing_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"user_role" text NOT NULL,
	"operation" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_name" text NOT NULL,
	"details" text NOT NULL,
	"data" jsonb,
	"timestamp" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cost_pricing_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cost_quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"client_name" text NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cost_raw_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"cost_with_waste" double precision DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coupon_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"coupon_id" text NOT NULL,
	"coupon_code" text,
	"action" text NOT NULL,
	"performed_by" text NOT NULL,
	"user_id" text,
	"user_role" text,
	"details" jsonb,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coupon_send_history" (
	"id" text PRIMARY KEY NOT NULL,
	"coupon_id" text NOT NULL,
	"coupon_code" text NOT NULL,
	"customer_id" text,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"customer_email" text,
	"channel" text DEFAULT 'clipboard' NOT NULL,
	"sent_at" text NOT NULL,
	"sent_by_user_id" text NOT NULL,
	"sent_by_user_name" text NOT NULL,
	"message_preview" text NOT NULL,
	"status" text DEFAULT 'copied' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coupon_usages" (
	"id" text PRIMARY KEY NOT NULL,
	"coupon_id" text NOT NULL,
	"coupon_code" text NOT NULL,
	"order_id" text NOT NULL,
	"order_code" text NOT NULL,
	"customer_id" text,
	"customer_name" text DEFAULT 'Cliente',
	"customer_email" text,
	"customer_phone" text,
	"customer_cpf_cnpj" text,
	"subtotal" double precision DEFAULT 0 NOT NULL,
	"eligible_amount" double precision DEFAULT 0,
	"discount_applied" double precision DEFAULT 0 NOT NULL,
	"shipping_cost" double precision DEFAULT 0,
	"final_total" double precision DEFAULT 0,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"cancelled_at" text,
	"cancel_reason" text,
	"used_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "discount_coupons" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"campaign_name" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" double precision NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"min_purchase_amount" double precision,
	"max_discount_amount" double precision,
	"max_uses" integer DEFAULT 0,
	"current_uses" integer DEFAULT 0,
	"limit_per_customer" integer DEFAULT 1,
	"applicable_type" text DEFAULT 'all_store' NOT NULL,
	"allowed_product_ids" jsonb DEFAULT '[]'::jsonb,
	"allowed_category_ids" jsonb DEFAULT '[]'::jsonb,
	"allowed_customer_ids" jsonb DEFAULT '[]'::jsonb,
	"customer_restriction" text DEFAULT 'general',
	"specific_customer_emails" jsonb DEFAULT '[]'::jsonb,
	"allow_cumulative" boolean DEFAULT true,
	"total_discount_granted" double precision DEFAULT 0,
	"total_sales_volume" double precision DEFAULT 0,
	"sent_count" integer DEFAULT 0,
	"status" text DEFAULT 'active' NOT NULL,
	"internal_notes" text,
	"created_by" text,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "discount_coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"entity_name" text NOT NULL,
	"document_number" text,
	"amount" double precision NOT NULL,
	"paid_amount" double precision DEFAULT 0,
	"remaining_amount" double precision NOT NULL,
	"due_date" text NOT NULL,
	"issue_date" text NOT NULL,
	"payment_date" text,
	"status" text NOT NULL,
	"category_id" text,
	"cost_center_id" text,
	"bank_account_id" text,
	"payment_method_id" text,
	"order_id" text,
	"quote_id" text,
	"notes" text,
	"installments" jsonb,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"user_email" text,
	"user_role" text NOT NULL,
	"operation" text NOT NULL,
	"permission_used" text,
	"affected_record_id" text,
	"affected_record_type" text NOT NULL,
	"previous_values" jsonb,
	"new_values" jsonb,
	"result" text DEFAULT 'sucesso' NOT NULL,
	"details" text NOT NULL,
	"origin" text DEFAULT 'web_painel',
	"timestamp" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"color" text DEFAULT '#10B981',
	"description" text DEFAULT '',
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_payment_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"tax_percent" double precision DEFAULT 0,
	"settlement_days" integer DEFAULT 0,
	"allow_installments" boolean DEFAULT false,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"client_id" text,
	"client_name" text NOT NULL,
	"client_email" text NOT NULL,
	"client_phone" text NOT NULL,
	"client_company" text,
	"shipping_address" jsonb,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" double precision DEFAULT 0 NOT NULL,
	"discount" double precision DEFAULT 0,
	"coupon_code" text,
	"coupon_id" text,
	"coupon_discount" double precision,
	"coupon_info" jsonb,
	"shipping_cost" double precision DEFAULT 0,
	"shipping_info" jsonb,
	"total" double precision DEFAULT 0 NOT NULL,
	"payment_method" text DEFAULT 'pix' NOT NULL,
	"payment_status" text DEFAULT 'pendente' NOT NULL,
	"order_status" text DEFAULT 'novo' NOT NULL,
	"tracking_code" text,
	"source_quote_id" text,
	"billing_terms" jsonb,
	"notes" text,
	"boletos" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"user_role" text NOT NULL,
	"action" text NOT NULL,
	"details" text NOT NULL,
	"timestamp" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"sale_id" text,
	"sale_code" text,
	"order_id" text,
	"origin" text DEFAULT 'loja_online' NOT NULL,
	"gateway" text DEFAULT 'mercadopago' NOT NULL,
	"gateway_transaction_id" text,
	"method" text NOT NULL,
	"gross_amount" double precision DEFAULT 0 NOT NULL,
	"fee_amount" double precision DEFAULT 0,
	"net_amount" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"raw_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pdv_sales" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"customer_name" text DEFAULT 'Consumidor Final',
	"customer_cpf_cnpj" text,
	"operator_id" text,
	"operator_name" text,
	"cash_register_number" integer DEFAULT 1,
	"subtotal" double precision DEFAULT 0 NOT NULL,
	"discount" double precision DEFAULT 0,
	"total" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'concluida' NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category_id" text NOT NULL,
	"subcategory_id" text,
	"short_description" text DEFAULT '',
	"description" text DEFAULT '',
	"base_price" double precision DEFAULT 0 NOT NULL,
	"promo_price" double precision,
	"cost_price" double precision,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"min_order_qty" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false,
	"images" jsonb DEFAULT '[]'::jsonb,
	"badge" text,
	"show_price" boolean DEFAULT true,
	"price_tiers" jsonb DEFAULT '[]'::jsonb,
	"variants" jsonb DEFAULT '[]'::jsonb,
	"details" jsonb,
	"barcode" text,
	"qr_code" text,
	"total_stock_available" integer DEFAULT 0,
	"total_next_quantities" integer DEFAULT 0,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"client_id" text,
	"client_name" text NOT NULL,
	"client_email" text NOT NULL,
	"client_phone" text NOT NULL,
	"client_company" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" double precision DEFAULT 0 NOT NULL,
	"discount" double precision DEFAULT 0,
	"total" double precision DEFAULT 0 NOT NULL,
	"notes" text,
	"status" text DEFAULT 'pendente' NOT NULL,
	"admin_notes" text,
	"responded_at" text,
	"responded_by" text,
	"billing_terms" jsonb,
	"validity_date" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shopping_carts" (
	"owner_key" text PRIMARY KEY NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"variant_id" text,
	"variant_color" text,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"previous_stock" integer DEFAULT 0 NOT NULL,
	"new_stock" integer DEFAULT 0 NOT NULL,
	"reason" text DEFAULT '',
	"operator_name" text DEFAULT 'Sistema',
	"created_at_text" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stricker_config" (
	"id" text PRIMARY KEY NOT NULL,
	"environment" text DEFAULT 'homologacao' NOT NULL,
	"api_url" text DEFAULT 'https://ws.spotgifts.com.br/api/v1SSL/' NOT NULL,
	"session_token" text,
	"token_expires_at" text,
	"auto_sync_enabled" boolean DEFAULT true NOT NULL,
	"sync_interval_hours" integer DEFAULT 12 NOT NULL,
	"last_sync_at" text,
	"data" jsonb,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stricker_customization_tables" (
	"table_code" text PRIMARY KEY NOT NULL,
	"technique_code" text DEFAULT '',
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stricker_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"log_type" text NOT NULL,
	"status" text NOT NULL,
	"data" jsonb NOT NULL,
	"timestamp" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stricker_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_stamp" text NOT NULL,
	"internal_reference" text NOT NULL,
	"status" text DEFAULT 'PROCESSING' NOT NULL,
	"order_total" double precision DEFAULT 0 NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "stricker_products" (
	"reference" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brand" text DEFAULT '',
	"category" text DEFAULT '',
	"status" text DEFAULT 'ativo',
	"published_to_catalog" boolean DEFAULT false,
	"total_stock_available" integer DEFAULT 0,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subcategories" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_favorites" (
	"owner_key" text PRIMARY KEY NOT NULL,
	"product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text DEFAULT '',
	"company" text DEFAULT '',
	"cpf_cnpj" text DEFAULT '',
	"state_registration" text DEFAULT '',
	"role" text DEFAULT 'cliente' NOT NULL,
	"password_hash" text,
	"address" jsonb,
	"custom_permissions" jsonb,
	"favorite_product_ids" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"last_login" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
