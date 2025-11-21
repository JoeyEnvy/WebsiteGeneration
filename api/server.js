// api/server.js — Bulletproof for Vercel 2025
let app;
try {
  app = await import("../Backend/index.js").then(m => m.default);
  console.log("✅ Express app imported successfully in api/server.js");
} catch (error) {
  console.error("❌ Failed to import Backend/index.js:", error.message);
}

export const config = {
  api: {
    bodyParser: { sizeLimit: "3mb" },
    maxDuration: 60,  // For OpenAI calls
    runtime: "nodejs20.x",  // Explicit Node version
  },
};

export default function handler(req, res) {
  if (!app) {
    console.error("❌ No app available — import failed");
    return res.status(500).json({ error: "Server setup failed" });
  }
  console.log(`📥 Incoming request: ${req.method} ${req.url} from origin ${req.headers.origin}`);
  return app(req, res);
}