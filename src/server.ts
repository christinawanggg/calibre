import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import searchRoute from "./routes/search";
import rateRoute from "./routes/rate";

const app = new Hono();

app.use("/api/*", cors());
app.route("/api", searchRoute);
app.route("/api", rateRoute);

// Serve built client in production
app.use("/*", serveStatic({ root: "./client/dist" }));
app.notFound(async (c) => c.html(await Bun.file("./client/dist/index.html").text()));

export default { port: 3001, fetch: app.fetch, idleTimeout: 120 };
