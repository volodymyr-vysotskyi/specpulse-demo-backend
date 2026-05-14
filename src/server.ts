import { buildApp } from "./app.js";

const app = await buildApp();

if (process.env.NODE_ENV !== "test") {
  await app.listen({ port: Number(process.env.PORT ?? 3001), host: "0.0.0.0" });
}

export { app };
