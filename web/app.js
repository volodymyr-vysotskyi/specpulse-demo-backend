(function () {
  "use strict";

  const API = "";

  /** @type {{ id: string; email: string; name: string; role: string } | null} */
  let currentUser = null;

  function isAdminRole(role) {
    return role === "admin" || role === "superadmin";
  }

  function roleLabel(role) {
    if (isAdminRole(role)) return "Admin";
    return "Client";
  }

  async function api(path, options) {
    const res = await fetch(API + path, {
      credentials: "include",
      headers: { Accept: "application/json", ...(options?.headers || {}) },
      ...options,
    });
    return res;
  }

  async function refreshSession() {
    const res = await api("/auth/me");
    if (res.ok) {
      currentUser = await res.json();
      return true;
    }
    currentUser = null;
    return false;
  }

  function getHashRoute() {
    const raw = window.location.hash.replace(/^#/, "") || "/";
    return raw.startsWith("/") ? raw : "/" + raw;
  }

  function navigate(hashPath) {
    window.location.hash = hashPath.startsWith("#")
      ? hashPath
      : "#" + (hashPath.startsWith("/") ? hashPath : "/" + hashPath);
  }

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function mount(node) {
    const root = document.getElementById("root");
    root.replaceChildren(node);
  }

  function layout(mainHtml, opts) {
    const { showNav } = opts || {};
    const route = getHashRoute();
    const authed = !!currentUser;
    const admin = authed && isAdminRole(currentUser.role);

    const navLinks = [];
    if (authed) {
      navLinks.push(
        `<a href="#/dashboard" class="${route === "/dashboard" || route === "/" ? "is-active" : ""}">Home</a>`,
      );
      if (admin) {
        navLinks.push(
          `<a href="#/admin" class="${route.startsWith("/admin") ? "is-active" : ""}">Admin</a>`,
        );
      }
    }

    const html = `
      <div>
        <header class="topbar">
          <span class="brand">Demo app</span>
          ${
            showNav && authed
              ? `<nav class="nav">${navLinks.join("")}<button type="button" class="danger" id="btn-signout">Sign out</button></nav>`
              : ""
          }
        </header>
        ${mainHtml}
      </div>`;

    const wrap = el(html);
    const btn = wrap.querySelector("#btn-signout");
    if (btn) {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        await api("/auth/logout", { method: "POST" });
        currentUser = null;
        navigate("/login");
        await route();
        btn.disabled = false;
      });
    }
    mount(wrap);
  }

  function viewLogin() {
    layout(
      `<section class="card">
        <h1>Sign in</h1>
        <p>Use the email and password you registered with. The first account in a fresh server is an admin; later accounts are clients.</p>
        <form id="login-form">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="username" required />
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
          <p class="form-error" id="login-error" hidden></p>
          <button type="submit" class="primary" id="login-submit">Sign in</button>
        </form>
      </section>`,
      { showNav: false },
    );

    const form = document.getElementById("login-form");
    const err = document.getElementById("login-error");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.hidden = true;
      const fd = new FormData(form);
      const submit = document.getElementById("login-submit");
      submit.disabled = true;
      const res = await api("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(fd.get("email") || ""),
          password: String(fd.get("password") || ""),
        }),
      });
      submit.disabled = false;
      if (!res.ok) {
        err.textContent =
          "We could not sign you in. Check your email and password and try again.";
        err.hidden = false;
        return;
      }
      const data = await res.json();
      currentUser = data.user;
      navigate("/dashboard");
      await route();
    });
  }

  function viewDashboard() {
    const u = currentUser;
    const admin = isAdminRole(u.role);
    layout(
      `<section class="card">
        <h1>Welcome, ${escapeHtml(u.name)}</h1>
        <p>You are signed in as <strong>${escapeHtml(u.email)}</strong>
          <span class="role-pill">${escapeHtml(roleLabel(u.role))}</span>
        </p>
        ${
          admin
            ? `<p>As an admin you can open the <a href="#/admin">admin area</a> to review users in this demo.</p>`
            : `<p>This is your client home. Admin-only tools are not shown in the menu.</p>`
        }
      </section>`,
      { showNav: true },
    );
  }

  function viewAccessDenied() {
    layout(
      `<section class="card">
        <div class="banner-denied">
          <h1>Access not available</h1>
          <p>You do not have access to this area. It is reserved for administrators. If you believe you should have access, contact your organization’s administrator.</p>
          <p><a href="#/dashboard">Back to home</a></p>
        </div>
      </section>`,
      { showNav: true },
    );
  }

  function viewAdmin() {
    layout(
      `<section class="card">
        <h1>Admin</h1>
        <p>Demo listing from the server (for administrators only).</p>
        <div id="admin-users">Loading…</div>
      </section>`,
      { showNav: true },
    );

    const host = document.getElementById("admin-users");
    api("/users")
      .then(async (res) => {
        if (res.status === 401) {
          currentUser = null;
          navigate("/login");
          await route();
          return;
        }
        if (!res.ok) {
          host.textContent = "Could not load users.";
          return;
        }
        const users = await res.json();
        if (!Array.isArray(users) || users.length === 0) {
          host.textContent = "No users yet.";
          return;
        }
        const items = users
          .map(
            (x) =>
              `<li>${escapeHtml(x.name)} &lt;${escapeHtml(x.email)}&gt;
                <span class="role-pill">${escapeHtml(roleLabel(x.role))}</span></li>`,
          )
          .join("");
        host.innerHTML = `<ul class="user-list">${items}</ul>`;
      })
      .catch(() => {
        host.textContent = "Could not load users.";
      });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function route() {
    const ok = await refreshSession();
    let path = getHashRoute();
    if (path === "/") path = "/dashboard";

    if (!ok) {
      if (path !== "/login") {
        navigate("/login");
        viewLogin();
        return;
      }
      viewLogin();
      return;
    }

    if (path === "/login") {
      navigate("/dashboard");
      await route();
      return;
    }

    if (path === "/dashboard" || path === "/") {
      viewDashboard();
      return;
    }

    if (path.startsWith("/admin")) {
      if (!isAdminRole(currentUser.role)) {
        viewAccessDenied();
        return;
      }
      viewAdmin();
      return;
    }

    navigate("/dashboard");
    await route();
  }

  window.addEventListener("hashchange", () => {
    route();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") route();
  });

  route();
})();
