// api/server.js — With debug logs for Vercel
import app from "../Backend/index.js";  // If this fails, logs will show

console.log("✅ api/server.js loaded — Express app imported successfully");

export const config = {
  api: {
    bodyParser: { sizeLimit: "3mb" },
    maxDuration: 60,
  },
};

export default function handler(req, res) {
  console.log(`📥 Request to ${req.url} from ${req.headers.origin}`);
  return app(req, res);
}