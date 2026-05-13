import assert from "node:assert/strict";
import { test } from "node:test";
import { canAccessPaidContent } from "../dist/membership.js";

test("expired memberships cannot access paid content and receive a reason", () => {
  assert.deepEqual(canAccessPaidContent({ status: "expired" }), {
    allowed: false,
    reason: "Your membership has expired. Renew to access paid content.",
  });
});
