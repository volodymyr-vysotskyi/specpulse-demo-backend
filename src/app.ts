import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { canAccessPaidContent } from "./membership.js";
import { hashPassword, verifyPassword } from "./password.js";
import { SessionStore } from "./session-store.js";
import {
  type Role,
  isElevatedRole,
  toPublicUser,
  UserStore,
  UserStoreError,
} from "./user-store.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: {
      id: string;
      email: string;
      name: string;
      role: Role;
    };
  }
}

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

function readBearerToken(req: FastifyRequest): string | undefined {
  const raw = req.headers.authorization;
  if (!raw || !raw.startsWith("Bearer ")) return undefined;
  const token = raw.slice("Bearer ".length).trim();
  return token.length > 0 ? token : undefined;
}

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify();
  const userStore = new UserStore();
  const sessions = new SessionStore();

  fastify.setErrorHandler((err, req, reply) => {
    if (err instanceof UserStoreError) {
      return reply.status(err.statusCode).send({ error: err.code });
    }
    req.log.error(err);
    return reply.status(500).send({ error: "internal_error" });
  });

  async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
    const token = readBearerToken(req);
    if (!token) {
      return reply.status(401).send({ error: "missing_token" });
    }
    const userId = sessions.getUserId(token);
    if (!userId) {
      return reply.status(401).send({ error: "invalid_token" });
    }
    const user = userStore.getById(userId);
    if (!user) {
      return reply.status(401).send({ error: "invalid_token" });
    }
    req.authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  async function requireElevated(req: FastifyRequest, reply: FastifyReply) {
    const r = await requireAuth(req, reply);
    if (r !== undefined) return r;
    if (!req.authUser || !isElevatedRole(req.authUser.role)) {
      return reply.status(403).send({ error: "forbidden" });
    }
  }

  /** Demoting or removing the last admin/superadmin is not allowed. */
  function assertNotLastElevated(
    target: { id: string; role: Role },
    nextRole?: Role,
  ): void {
    if (!isElevatedRole(target.role)) return;
    const staysElevated =
      nextRole === undefined ? true : isElevatedRole(nextRole);
    if (staysElevated) return;
    if (userStore.elevatedCount() <= 1) {
      throw new UserStoreError("last_admin", 400);
    }
  }

  function parseRole(value: unknown, fallback: Role): Role {
    if (value === "user" || value === "admin" || value === "superadmin") {
      return value;
    }
    return fallback;
  }

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
    const token = sessions.createSession(user.id);
    return reply.status(201).send({
      token,
      user: toPublicUser(user),
    });
  });

  fastify.post("/auth/login", async (req, reply) => {
    const body = parseJsonBody<{
      email?: unknown;
      password?: unknown;
    }>(req.body);
    if (!body) {
      return reply.status(400).send({ error: "invalid_body" });
    }
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = userStore.findByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return reply.status(401).send({ error: "invalid_credentials" });
    }
    const token = sessions.createSession(user.id);
    return { token, user: toPublicUser(user) };
  });

  fastify.post(
    "/auth/logout",
    { preHandler: requireAuth },
    async (req, reply) => {
      const token = readBearerToken(req);
      if (token) sessions.revoke(token);
      return reply.status(204).send();
    },
  );

  fastify.get(
    "/users/me",
    { preHandler: requireAuth },
    async (req) => {
      const user = userStore.getById(req.authUser!.id)!;
      return toPublicUser(user);
    },
  );

  fastify.patch(
    "/users/me",
    { preHandler: requireAuth },
    async (req, reply) => {
      const body = parseJsonBody<{
        name?: unknown;
        password?: unknown;
      }>(req.body);
      if (!body) {
        return reply.status(400).send({ error: "invalid_body" });
      }
      const patch: Parameters<UserStore["update"]>[1] = {};
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
      const user = userStore.update(req.authUser!.id, patch);
      return toPublicUser(user);
    },
  );

  fastify.get("/users", { preHandler: requireElevated }, async () => {
    return userStore.list();
  });

  fastify.get(
    "/users/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const actor = req.authUser!;
      if (!isElevatedRole(actor.role) && actor.id !== id) {
        return reply.status(403).send({ error: "forbidden" });
      }
      const user = userStore.getById(id);
      if (!user) {
        return reply.status(404).send({ error: "not_found" });
      }
      return toPublicUser(user);
    },
  );

  fastify.post(
    "/users",
    { preHandler: requireElevated },
    async (req, reply) => {
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
      if (
        role === "superadmin" &&
        req.authUser!.role !== "superadmin"
      ) {
        return reply.status(403).send({ error: "forbidden" });
      }
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
    },
  );

  fastify.patch(
    "/users/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const actor = req.authUser!;
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

      if (!isElevatedRole(actor.role) && actor.id !== id) {
        return reply.status(403).send({ error: "forbidden" });
      }

      if (actor.role === "admin" && target.role === "superadmin") {
        return reply.status(403).send({ error: "forbidden" });
      }

      const patch: Parameters<UserStore["update"]>[1] = {};

      if (isElevatedRole(actor.role)) {
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
          const resolvedRole = body.role as Role;
          if (
            resolvedRole === "superadmin" &&
            actor.role !== "superadmin"
          ) {
            return reply.status(403).send({ error: "forbidden" });
          }
          assertNotLastElevated(target, resolvedRole);
          patch.role = resolvedRole;
        }
      } else {
        if (body.email !== undefined || body.role !== undefined) {
          return reply.status(403).send({ error: "forbidden" });
        }
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
    },
  );

  fastify.delete(
    "/users/:id",
    { preHandler: requireElevated },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const actor = req.authUser!;
      const target = userStore.getById(id);
      if (!target) {
        return reply.status(404).send({ error: "not_found" });
      }
      if (actor.role === "admin" && target.role === "superadmin") {
        return reply.status(403).send({ error: "forbidden" });
      }
      if (isElevatedRole(target.role) && userStore.elevatedCount() <= 1) {
        return reply.status(400).send({ error: "last_admin" });
      }
      userStore.delete(id);
      return reply.status(204).send();
    },
  );

  return fastify;
}
