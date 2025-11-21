import app from "../Backend/index.js";

export default function handler(req, res) {
  // Pass the incoming request directly to Express
  return app(req, res);
}
