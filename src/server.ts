import Fastify from "fastify";
import { canAccessPaidContent } from "./membership.js";

const app = Fastify();

app.get("/membership/access", async () => {
  return canAccessPaidContent({ status: "expired" });
});

if (process.env.NODE_ENV !== "test") {
  await app.listen({ port: Number(process.env.PORT ?? 3001), host: "0.0.0.0" });
}
