import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../dist/app.js";

/** @param {{ headers: Record<string, string | string[] | undefined> }} res */
function sessionCookie(res) {
  const sc = res.headers["set-cookie"];
  if (!sc) return "";
  const line = Array.isArray(sc) ? sc[0] : String(sc);
  return line.split(";")[0];
}

test("first registration becomes superadmin; list users needs no auth", async () => {
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
  const { user } = JSON.parse(reg.body);
  assert.equal(user.role, "superadmin");
  assert.equal("token" in JSON.parse(reg.body), false);

  const list = await app.inject({ method: "GET", url: "/users" });
  assert.equal(list.statusCode, 200);
  const users = JSON.parse(list.body);
  assert.equal(users.length, 1);
  assert.equal(users[0].email, "admin@example.com");
});

test("any client can list users after multiple registrations", async () => {
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
  await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "b@example.com",
      password: "password12",
      name: "B",
    },
  });
  const list = await app.inject({ method: "GET", url: "/users" });
  assert.equal(list.statusCode, 200);
  assert.equal(JSON.parse(list.body).length, 2);
});

test("register returns user; POST /users creates without auth", async () => {
  const app = await buildApp();
  const { user } = JSON.parse(
    (
      await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          email: "super@example.com",
          password: "password12",
          name: "Super",
        },
      })
    ).body,
  );
  const created = await app.inject({
    method: "POST",
    url: "/users",
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

  const got = await app.inject({ method: "GET", url: `/users/${user.id}` });
  assert.equal(got.statusCode, 200);
  assert.equal(JSON.parse(got.body).email, "super@example.com");
});

test("PATCH can change sole superadmin to user", async () => {
  const app = await buildApp();
  const { user } = JSON.parse(
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
  assert.equal(user.role, "superadmin");
  const patch = await app.inject({
    method: "PATCH",
    url: `/users/${user.id}`,
    payload: { role: "user" },
  });
  assert.equal(patch.statusCode, 200);
  assert.equal(JSON.parse(patch.body).role, "user");
});

test("register issues session cookie; GET /auth/me returns user", async () => {
  const app = await buildApp();
  const reg = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "session@example.com",
      password: "password12",
      name: "Session",
    },
  });
  assert.equal(reg.statusCode, 201);
  const cookie = sessionCookie(reg);
  assert.ok(cookie.startsWith("sp_session="));
  const me = await app.inject({
    method: "GET",
    url: "/auth/me",
    headers: { cookie },
  });
  assert.equal(me.statusCode, 200);
  assert.equal(JSON.parse(me.body).email, "session@example.com");
});

test("POST /auth/login rejects wrong password", async () => {
  const app = await buildApp();
  await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "login@example.com",
      password: "password12",
      name: "L",
    },
  });
  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "login@example.com", password: "wrongpass12" },
  });
  assert.equal(login.statusCode, 401);
});

test("POST /auth/login sets cookie; logout invalidates session", async () => {
  const app = await buildApp();
  await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: "out@example.com",
      password: "password12",
      name: "O",
    },
  });
  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email: "out@example.com", password: "password12" },
  });
  assert.equal(login.statusCode, 200);
  const cookie = sessionCookie(login);
  const okMe = await app.inject({
    method: "GET",
    url: "/auth/me",
    headers: { cookie },
  });
  assert.equal(okMe.statusCode, 200);

  const out = await app.inject({
    method: "POST",
    url: "/auth/logout",
    headers: { cookie },
  });
  assert.equal(out.statusCode, 204);

  const badMe = await app.inject({
    method: "GET",
    url: "/auth/me",
    headers: { cookie },
  });
  assert.equal(badMe.statusCode, 401);
});
