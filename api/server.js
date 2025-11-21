// api/server.js
import app from "../Backend/index.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "3mb", // safe for base64 ZIPs and large prompts
    },
    // Important for streaming / long-running functions on Vercel
    maxDuration: 60, // seconds (increase if generation ever times out)
  },
};

export default function handler(req, res) {
  return app(req, res);
}