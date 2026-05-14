import { randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;

export class SessionStore {
  private readonly tokenToUserId = new Map<string, string>();

  createSession(userId: string): string {
    const token = randomBytes(TOKEN_BYTES).toString("hex");
    this.tokenToUserId.set(token, userId);
    return token;
  }

  getUserId(token: string): string | undefined {
    return this.tokenToUserId.get(token);
  }

  revoke(token: string): void {
    this.tokenToUserId.delete(token);
  }
}
