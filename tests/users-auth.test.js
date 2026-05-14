import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../dist/app.js";

test("first registration becomes admin and can list users", async () => {
  const app = await buildApp();
  const reg = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "Admin@Example.com",
      password: "password12",
      name: "Root",
    },
  });
  assert.equal(reg.statusCode, 201);
  const { token, user } = JSON.parse(reg.body);
  assert.equal(user.role, "admin");
  assert.ok(typeof token === "string" && token.length > 0);

  const list = await app.inject({
    method: "GET",
    url: "/users",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(list.statusCode, 200);
  const users = JSON.parse(list.body);
  assert.equal(users.length, 1);
  assert.equal(users[0].email, "admin@example.com");
});

test("second registration is user; cannot list users", async () => {
  const app = await buildApp();
  await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "a@example.com",
      password: "password12",
      name: "A",
    },
  });
  const reg2 = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "b@example.com",
      password: "password12",
      name: "B",
    },
  });
  assert.equal(reg2.statusCode, 201);
  const { token } = JSON.parse(reg2.body);
  const list = await app.inject({
    method: "GET",
    url: "/users",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(list.statusCode, 403);
});

test("login returns token; invalid credentials rejected", async () => {
  const app = await buildApp();
  await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "u@example.com",
      password: "password12",
      name: "U",
    },
  });
  const ok = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "u@example.com", password: "password12" },
  });
  assert.equal(ok.statusCode, 200);
  const bad = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "u@example.com", password: "wrongpass" },
  });
  assert.equal(bad.statusCode, 401);
});

test("admin can create user with role user", async () => {
  const app = await buildApp();
  const { token } = JSON.parse(
    (
      await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email: "admin@example.com",
          password: "password12",
          name: "Admin",
        },
      })
    ).body,
  );
  const created = await app.inject({
    method: "POST",
    url: "/users",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      email: "child@example.com",
      password: "password12",
      name: "Child",
      role: "user",
    },
  });
  assert.equal(created.statusCode, 201);
  const u = JSON.parse(created.body);
  assert.equal(u.role, "user");
});

test("cannot demote last admin", async () => {
  const app = await buildApp();
  const { token, user } = JSON.parse(
    (
      await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email: "solo@example.com",
          password: "password12",
          name: "Solo",
        },
      })
    ).body,
  );
  assert.equal(user.role, "admin");
  const patch = await app.inject({
    method: "PATCH",
    url: `/users/${user.id}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { role: "user" },
  });
  assert.equal(patch.statusCode, 400);
  assert.deepEqual(JSON.parse(patch.body), { error: "last_admin" });
});
