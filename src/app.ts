import Fastify, { type FastifyInstance } from "fastify";
import { canAccessPaidContent } from "./membership.js";
import { hashPassword } from "./password.js";
import { type Role, toPublicUser, UserStore, UserStoreError } from "./user-store.js";

const MIN_PASSWORD_LEN = 8;

function parseJsonBody<T extends Record<string, unknown>>(
  body: unknown,
): T | null {
  if (body && typeof body === "object") return body as T;
  return null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseRole(value: unknown, fallback: Role): Role {
  if (value === "user" || value === "admin" || value === "superadmin") {
    return value;
  }
  return fallback;
}

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify();
  const userStore = new UserStore();

  fastify.setErrorHandler((err, req, reply) => {
    if (err instanceof UserStoreError) {
      return reply.status(err.statusCode).send({ error: err.code });
    }
    req.log.error(err);
    return reply.status(500).send({ error: "internal_error" });
  });

  fastify.get("/membership/access", async () => {
    return canAccessPaidContent({ status: "expired" });
  });

  fastify.post("/auth/register", async (req, reply) => {
    const body = parseJsonBody<{
      email?: unknown;
      password?: unknown;
      name?: unknown;
    }>(req.body);
    if (!body) {
      return reply.status(400).send({ error: "invalid_body" });
    }
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name : "";
    if (!isValidEmail(email)) {
      return reply.status(400).send({ error: "invalid_email" });
    }
    if (password.length < MIN_PASSWORD_LEN) {
      return reply.status(400).send({ error: "weak_password" });
    }
    if (!name.trim()) {
      return reply.status(400).send({ error: "invalid_name" });
    }
    const role: Role = userStore.count() === 0 ? "superadmin" : "user";
    const user = userStore.create({
      email,
      passwordHash: hashPassword(password),
      name,
      role,
    });
    return reply.status(201).send({ user: toPublicUser(user) });
  });

  fastify.get("/users", async () => {
    return userStore.list();
  });

  fastify.get("/users/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = userStore.getById(id);
    if (!user) {
      return reply.status(404).send({ error: "not_found" });
    }
    return toPublicUser(user);
  });

  fastify.post("/users", async (req, reply) => {
    const body = parseJsonBody<{
      email?: unknown;
      password?: unknown;
      name?: unknown;
      role?: unknown;
    }>(req.body);
    if (!body) {
      return reply.status(400).send({ error: "invalid_body" });
    }
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name : "";
    const role = parseRole(body.role, "user");
    if (!isValidEmail(email)) {
      return reply.status(400).send({ error: "invalid_email" });
    }
    if (password.length < MIN_PASSWORD_LEN) {
      return reply.status(400).send({ error: "weak_password" });
    }
    if (!name.trim()) {
      return reply.status(400).send({ error: "invalid_name" });
    }
    const user = userStore.create({
      email,
      passwordHash: hashPassword(password),
      name,
      role,
    });
    return reply.status(201).send(toPublicUser(user));
  });

  fastify.patch("/users/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const target = userStore.getById(id);
    if (!target) {
      return reply.status(404).send({ error: "not_found" });
    }

    const body = parseJsonBody<{
      email?: unknown;
      name?: unknown;
      password?: unknown;
      role?: unknown;
    }>(req.body);
    if (!body) {
      return reply.status(400).send({ error: "invalid_body" });
    }

    const patch: Parameters<UserStore["update"]>[1] = {};

    if (body.email !== undefined) {
      if (typeof body.email !== "string" || !isValidEmail(body.email)) {
        return reply.status(400).send({ error: "invalid_email" });
      }
      patch.email = body.email;
    }
    if (body.role !== undefined) {
      if (typeof body.role !== "string") {
        return reply.status(400).send({ error: "invalid_role" });
      }
      if (
        body.role !== "user" &&
        body.role !== "admin" &&
        body.role !== "superadmin"
      ) {
        return reply.status(400).send({ error: "invalid_role" });
      }
      patch.role = body.role as Role;
    }
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return reply.status(400).send({ error: "invalid_name" });
      }
      patch.name = body.name;
    }
    if (body.password !== undefined) {
      if (typeof body.password !== "string") {
        return reply.status(400).send({ error: "weak_password" });
      }
      if (body.password.length < MIN_PASSWORD_LEN) {
        return reply.status(400).send({ error: "weak_password" });
      }
      patch.passwordHash = hashPassword(body.password);
    }

    if (Object.keys(patch).length === 0) {
      return reply.status(400).send({ error: "empty_patch" });
    }

    const user = userStore.update(id, patch);
    return toPublicUser(user);
  });

  fastify.delete("/users/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const target = userStore.getById(id);
    if (!target) {
      return reply.status(404).send({ error: "not_found" });
    }
    userStore.delete(id);
    return reply.status(204).send();
  });

  return fastify;
}
