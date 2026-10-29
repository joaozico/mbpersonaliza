import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { strickerRouter } from "./src/server/strickerRouter";
import { strickerSyncWorker } from "./src/server/strickerSyncWorker";
import { paymentRouter } from "./src/server/paymentRouter";
import { systemRouter, maintenanceApiMiddleware } from "./src/server/systemRouter";
import { financialRouter } from "./src/server/financialRouter";
import { backupRouter } from "./src/server/backupRouter";
import { backupSchedulerWorker } from "./src/server/backupSchedulerWorker";
import { costPricingRouter } from "./src/server/costPricingRouter";
import { couponRouter } from "./src/server/couponRouter";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));

  // Inicia worker de sincronização periódica Stricker em segundo plano
  strickerSyncWorker.start();

  // Inicia worker de exportação agendada e recuperação de desastres
  backupSchedulerWorker.start();

  // API Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "MB Personaliza", version: "1.0.0" });
  });

  // Modo de Manutenção & Configurações do Sistema
  app.use("/api/system", systemRouter);

  // Middleware de proteção de APIs em modo de manutenção
  app.use(maintenanceApiMiddleware);

  // Payment Gateways & Webhooks (Mercado Pago & PagBank)
  app.use("/api/payments", paymentRouter);

  // Módulo Financeiro — Controle de Acesso e APIs Seguras
  app.use("/api/financial", financialRouter);

  // Backup & Recuperação de Desastres (JSON Seguro e Agendado)
  app.use("/api/backup", backupRouter);

  // Módulo de Orçamento de Custos e Precificação de Produtos
  app.use("/api/cost-pricing", costPricingRouter);

  // Módulo de Cupons de Desconto & Campanhas Promocionais
  app.use("/api/coupons", couponRouter);

  // Stricker / SPOT Webservice API Proxy Routes
  app.use("/api/stricker", strickerRouter);
  // Postman & Official Endpoint Compatibility Aliases
  app.use("/api/v1SSL", strickerRouter);
  app.use("/api/v1", strickerRouter);
  app.use("/downloads/v1SSL", strickerRouter);
  app.use("/downloads/v1", strickerRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MB Personaliza Server running on http://localhost:${PORT}`);
  });
}

startServer();
