import { Hono } from "hono";

// Define the 'Env' type that was missing.
// You can expand this with any environment variables your worker uses.
interface Env {
    // Example: DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));

export default app;