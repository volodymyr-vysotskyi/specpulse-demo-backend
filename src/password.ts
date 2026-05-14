import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_LEN = 16;
const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const key = scryptSync(password, salt, KEY_LEN);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  let salt: Buffer;
  let expectedKey: Buffer;
  try {
    salt = Buffer.from(parts[0], "hex");
    expectedKey = Buffer.from(parts[1], "hex");
  } catch {
    return false;
  }
  if (salt.length !== SALT_LEN || expectedKey.length !== KEY_LEN) return false;
  const key = scryptSync(password, salt, KEY_LEN);
  return timingSafeEqual(key, expectedKey);
}
