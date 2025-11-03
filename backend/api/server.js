// api/server.js
import serverless from "serverless-http";
import app from "../backend/index.js";   // your existing Express app
export const handler = serverless(app);
export default handler;
