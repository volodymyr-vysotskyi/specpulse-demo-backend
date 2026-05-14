import { randomBytes } from "node:crypto";

const sessions = new Map<string, string>();

export function createSession(userId: string): string {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, userId);
  return token;
}

export function getUserIdForSession(token: string | undefined): string | undefined {
  if (!token) return undefined;
  return sessions.get(token);
}

export function destroySession(token: string): void {
  sessions.delete(token);
}
