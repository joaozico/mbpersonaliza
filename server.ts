import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { strickerRouter } from "./src/server/strickerRouter";
import { strickerSyncWorker } from "./src/server/strickerSyncWorker";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));

  // Inicia worker de sincronização periódica Stricker em segundo plano
  strickerSyncWorker.start();

  // API Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "MB Personaliza", version: "1.0.0" });
  });

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
