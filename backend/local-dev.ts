import 'dotenv/config';
import { serve } from '@hono/node-server';
import app from './src/index';

const port = Number(process.env.PORT) || 8787;

console.log("=========================================");
console.log("🎯 Homework Sniper - Sniper Engine Node");
console.log(`Server is live at Port: ${port}`);
console.log("GROQ_API_KEY Status:", process.env.GROQ_API_KEY ? "LOADED ✅" : "MISSING ❌");
console.log("=========================================");

serve({
  fetch: app.fetch,
  port
});
