const sessionDurationSeconds = 60 * 60 * 24 * 7;
const encoder = new TextEncoder();

function encodeBase64Url(value) {
  return btoa(value)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64Url(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return encodeBase64Url(String.fromCharCode(...new Uint8Array(signature)));
}

async function createSession(secret) {
  const payload = encodeBase64Url(
    JSON.stringify({ expiresAt: Date.now() + sessionDurationSeconds * 1000 }),
  );
  return `${payload}.${await sign(payload, secret)}`;
}

async function hasValidSession(request, secret) {
  const session = (request.headers.get("Cookie") || "")
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("qa_reports_session="))
    ?.slice("qa_reports_session=".length);
  if (!session) return false;

  const [payload, signature] = session.split(".");
  if (!payload || !signature || signature !== (await sign(payload, secret)))
    return false;

  try {
    return JSON.parse(decodeBase64Url(payload)).expiresAt > Date.now();
  } catch {
    return false;
  }
}

function safeReturnTo(value) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function escapeHtml(value) {
  return value.replace(
    /[&<>\"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
  );
}

function redirect(location, headers = {}) {
  return new Response(null, {
    headers: { ...headers, Location: location },
    status: 302,
  });
}

function loginPage(returnTo, hasError) {
  const error = hasError
    ? '<p class="error" role="alert">Incorrect username or password. Please try again.</p>'
    : "";
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark light"><title>Sign in · QA Automation Reports</title><style>
    :root { font-family: Inter,ui-sans-serif,system-ui,sans-serif; color:#172033; background:#f6f8fc; } * { box-sizing:border-box; } body { min-width:320px; margin:0; background:radial-gradient(circle at top right,#dce9ff 0,transparent 32rem),#f6f8fc; } main { display:grid; min-height:100vh; place-items:center; padding:24px; } .card { width:min(100%,420px); padding:38px; border:1px solid #d9e2f2; border-radius:20px; background:rgba(255,255,255,.94); box-shadow:0 18px 50px rgba(33,55,99,.12); } .eyebrow { margin:0 0 12px; color:#155eef; font-size:13px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; } h1 { margin:0; font-size:30px; letter-spacing:-.03em; } .description { margin:12px 0 28px; color:#536076; line-height:1.55; } label { display:grid; gap:8px; margin-top:18px; font-size:14px; font-weight:700; } input { width:100%; min-height:46px; padding:0 12px; border:1px solid #b9c7dd; border-radius:9px; color:#172033; background:#fff; font:inherit; } input:focus { border-color:#155eef; outline:3px solid rgba(21,94,239,.14); } button { width:100%; min-height:48px; margin-top:26px; border:0; border-radius:10px; background:#155eef; color:#fff; cursor:pointer; font:700 15px/1 inherit; } button:hover { background:#004eeb; } .error { margin:0 0 18px; padding:11px 12px; border-radius:9px; background:#fee4e2; color:#b42318; font-size:14px; } @media (prefers-color-scheme:dark) { :root { color:#f7f9ff; background:#090d18; } body { background:radial-gradient(circle at top right,#1d315f 0,transparent 32rem),#090d18; } .card { border-color:#26324b; background:#101729; box-shadow:0 18px 50px rgba(0,0,0,.3); } .description { color:#97a5c0; } input { border-color:#3b4965; background:#151e32; color:#f7f9ff; } .error { background:#512231; color:#ffb2be; } }
  </style></head><body><main><form class="card" method="post" action="/login"><p class="eyebrow">Quality assurance</p><h1>QA Automation Reports</h1><p class="description">Sign in to view the latest results and report history.</p>${error}<input name="returnTo" type="hidden" value="${escapeHtml(returnTo)}"><label>Username<input name="username" autocomplete="username" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Sign in</button></form></main></body></html>`,
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=UTF-8",
      },
    },
  );
}

export default {
  async fetch(request, env) {
    if (
      !env.REPORTS_USERNAME ||
      !env.REPORTS_PASSWORD ||
      !env.REPORTS_SESSION_SECRET
    )
      return new Response("QA reports access is not configured yet.", {
        status: 503,
      });
    const url = new URL(request.url);

    if (url.pathname === "/logout")
      return redirect("/login", {
        "Cache-Control": "no-store",
        "Set-Cookie":
          "qa_reports_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
      });

    if (url.pathname === "/login") {
      const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
      if (request.method === "GET")
        return loginPage(returnTo, url.searchParams.get("error") === "1");
      if (request.method !== "POST")
        return new Response("Method not allowed", { status: 405 });

      const form = await request.formData();
      const requestedPage = safeReturnTo(form.get("returnTo"));
      const valid =
        form.get("username") === env.REPORTS_USERNAME &&
        form.get("password") === env.REPORTS_PASSWORD;
      if (!valid)
        return redirect(
          `/login?error=1&returnTo=${encodeURIComponent(requestedPage)}`,
        );

      return redirect(requestedPage, {
        "Cache-Control": "no-store",
        "Set-Cookie": `qa_reports_session=${await createSession(env.REPORTS_SESSION_SECRET)}; Path=/; Max-Age=${sessionDurationSeconds}; HttpOnly; Secure; SameSite=Lax`,
      });
    }

    if (!(await hasValidSession(request, env.REPORTS_SESSION_SECRET)))
      return redirect(
        `/login?returnTo=${encodeURIComponent(`${url.pathname}${url.search}`)}`,
        { "Cache-Control": "no-store" },
      );

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "private, no-store");
    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  },
};
