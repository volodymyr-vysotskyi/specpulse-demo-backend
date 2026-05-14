import { randomUUID } from "node:crypto";

export type Role = "user" | "admin";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export class UserStore {
  private readonly byId = new Map<string, User>();
  private readonly byEmail = new Map<string, string>();

  count(): number {
    return this.byId.size;
  }

  findByEmail(email: string): User | undefined {
    const id = this.byEmail.get(normalizeEmail(email));
    return id ? this.byId.get(id) : undefined;
  }

  getById(id: string): User | undefined {
    return this.byId.get(id);
  }

  list(): PublicUser[] {
    return [...this.byId.values()].map(toPublicUser);
  }

  create(input: {
    email: string;
    passwordHash: string;
    name: string;
    role: Role;
  }): User {
    const email = normalizeEmail(input.email);
    if (this.byEmail.has(email)) {
      throw new UserStoreError("email_taken", 409);
    }
    const user: User = {
      id: randomUUID(),
      email,
      passwordHash: input.passwordHash,
      name: input.name.trim(),
      role: input.role,
      createdAt: new Date().toISOString(),
    };
    this.byId.set(user.id, user);
    this.byEmail.set(email, user.id);
    return user;
  }

  update(
    id: string,
    patch: Partial<Pick<User, "email" | "passwordHash" | "name" | "role">>,
  ): User {
    const existing = this.byId.get(id);
    if (!existing) {
      throw new UserStoreError("not_found", 404);
    }

    let nextEmail = existing.email;
    if (patch.email !== undefined) {
      nextEmail = normalizeEmail(patch.email);
      if (nextEmail !== existing.email && this.byEmail.has(nextEmail)) {
        throw new UserStoreError("email_taken", 409);
      }
    }

    const updated: User = {
      ...existing,
      email: nextEmail,
      passwordHash: patch.passwordHash ?? existing.passwordHash,
      name: patch.name !== undefined ? patch.name.trim() : existing.name,
      role: patch.role ?? existing.role,
    };

    if (patch.email !== undefined && nextEmail !== existing.email) {
      this.byEmail.delete(existing.email);
      this.byEmail.set(nextEmail, existing.id);
    }

    this.byId.set(id, updated);
    return updated;
  }

  delete(id: string): void {
    const user = this.byId.get(id);
    if (!user) {
      throw new UserStoreError("not_found", 404);
    }
    this.byId.delete(id);
    this.byEmail.delete(user.email);
  }

  adminCount(): number {
    return [...this.byId.values()].filter((u) => u.role === "admin").length;
  }
}

export class UserStoreError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(code);
    this.name = "UserStoreError";
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
