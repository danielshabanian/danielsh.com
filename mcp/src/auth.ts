import type { AuthRequest, ConsentDescription, OAuthHelpers } from "@cloudflare/workers-oauth-provider";

// OAuth 2.1 authorization for the MCP server.
// MCP client -> /authorize (our consent page) -> GitHub sign-in -> /callback
// -> only ADMIN_GITHUB_LOGIN gets a grant. Tokens are issued by OAuthProvider.

export type Props = { login: string; name: string; githubId: number };
type AuthEnv = Env & { OAUTH_PROVIDER: OAuthHelpers };

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(title: string, body: string, headers = new Headers(), status = 200) {
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; form-action 'self' https://github.com; frame-ancestors 'none'; base-uri 'none'");
  headers.set("x-frame-options", "DENY");
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="color-scheme" content="dark light">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;600&family=JetBrains+Mono&display=swap">
<style>
:root{--bg:#0A0C0F;--surface:#12161B;--line:#262C34;--ink:#ECEDEE;--muted:#9BA4AE;--accent:#FF6B3D;--accent-ink:#0A0C0F}
@media (prefers-color-scheme:light){:root{--bg:#F5F4F0;--surface:#fff;--line:#DCD9D0;--ink:#121417;--muted:#545A62;--accent:#C2410C;--accent-ink:#fff}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:17px/1.6 "Instrument Sans",system-ui,sans-serif;padding:16px}
.card{width:100%;max-width:480px;background:var(--surface);border:1px solid var(--line);border-radius:28px;padding:40px}
h1{font:400 44px/1 "Instrument Serif",serif;margin:0 0 16px}em{color:var(--accent)}
.k{font:12px/1.5 "JetBrains Mono",monospace;letter-spacing:.1em;color:var(--accent);text-transform:uppercase}
dl{margin:24px 0;display:grid;grid-template-columns:auto 1fr;gap:8px 16px}dt{color:var(--muted)}dd{margin:0;word-break:break-all}
.warn{border:1px solid var(--accent);color:var(--accent);border-radius:16px;padding:12px 16px;font-size:15px}
.row{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}
button{font:600 16px "Instrument Sans",sans-serif;border-radius:999px;padding:14px 22px;cursor:pointer;border:1px solid var(--line);background:transparent;color:var(--ink)}
button.go{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
p{color:var(--muted)}
</style></head><body><main class="card">${body}</main></body></html>`,
    { status, headers }
  );
}

function consentPage(d: ConsentDescription, handle: string, headers: Headers) {
  return page(
    "Authorise access",
    `<span class="k">danielsh.com · site admin</span>
<h1>Allow <em>${esc(d.clientName)}</em> to edit your site?</h1>
<p>It will be able to change the content and images on danielsh.com. You'll sign in with GitHub next; only the site owner's account is accepted.</p>
<dl><dt>Client</dt><dd>${esc(d.clientDomain ? `${d.clientName} (${d.clientDomain})` : d.clientName)}</dd>
<dt>Sends tokens to</dt><dd>${esc(d.redirectHost)}</dd>
<dt>Access</dt><dd>${esc(d.scope.length ? d.scope.join(", ") : "site:write")}</dd></dl>
${d.redirectIsLoopback ? `<div class="warn">This redirects to an app on your own computer. Only approve if you just started this connection.</div>` : ""}
<form method="post" action="/authorize"><input type="hidden" name="handle" value="${esc(handle)}">
<div class="row"><button class="go" name="decision" value="approve" type="submit">Continue with GitHub</button><button name="decision" value="deny" type="submit">Cancel</button></div></form>`,
    headers
  );
}

function redirect(location: string, headers = new Headers()) {
  headers.set("location", location);
  headers.set("cache-control", "no-store");
  return new Response(null, { status: 302, headers });
}

export const authHandler = {
  async fetch(request: Request, env: AuthEnv): Promise<Response> {
    const url = new URL(request.url);
    const oauth = env.OAUTH_PROVIDER;

    if (url.pathname === "/" ) {
      return page("danielsh.com MCP", `<span class="k">Private</span><h1>Site admin <em>MCP</em></h1><p>This is a private Model Context Protocol server for editing danielsh.com. Connect an MCP client to <code>${esc(url.origin)}/mcp</code>; it will ask you to sign in.</p>`);
    }

    // 1. Consent page.
    if (url.pathname === "/authorize" && request.method === "GET") {
      let authReq: AuthRequest;
      try {
        authReq = await oauth.parseAuthRequest(request);
      } catch (e) {
        return page("Invalid request", `<h1>Invalid request</h1><p>${esc(e instanceof Error ? e.message : e)}</p>`, new Headers(), 400);
      }
      const desc = await oauth.describeConsent(authReq);
      const { handle, headers } = await oauth.beginConsent(authReq);
      return consentPage(desc, handle, headers);
    }

    // 2. Consent decision -> GitHub.
    if (url.pathname === "/authorize" && request.method === "POST") {
      const form = await request.formData();
      const handle = String(form.get("handle") ?? "");
      try {
        if (form.get("decision") !== "approve") {
          const denied = await oauth.denyConsent(request, handle);
          return new Response(null, { status: 302, headers: denied.headers });
        }
        const approved = await oauth.approveConsent(request, handle, { scope: ["site:write"] });
        const { state, headers } = await oauth.beginUpstream(approved.request, { headers: approved.headers });
        const gh = new URL("https://github.com/login/oauth/authorize");
        gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
        gh.searchParams.set("redirect_uri", new URL("/callback", url.origin).href);
        gh.searchParams.set("scope", "read:user");
        gh.searchParams.set("state", state);
        gh.searchParams.set("allow_signup", "false");
        return redirect(gh.href, headers);
      } catch (e) {
        return page("Expired", `<h1>That link expired</h1><p>Start the connection again from your MCP client.</p>`, new Headers(), 400);
      }
    }

    // 3. GitHub callback -> check the account -> issue the grant.
    if (url.pathname === "/callback") {
      let resumed;
      try {
        resumed = await oauth.finishUpstream(request);
      } catch {
        return page("Expired", `<h1>That sign-in expired</h1><p>Start the connection again from your MCP client.</p>`, new Headers(), 400);
      }
      const code = url.searchParams.get("code");
      if (!code) return page("Cancelled", `<h1>Sign-in cancelled</h1>`, resumed.headers, 400);

      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: new URL("/callback", url.origin).href,
        }),
      });
      const tok = (await tokenRes.json()) as { access_token?: string };
      if (!tok.access_token) return page("Sign-in failed", `<h1>GitHub sign-in failed</h1>`, resumed.headers, 502);

      const userRes = await fetch("https://api.github.com/user", {
        headers: { authorization: `Bearer ${tok.access_token}`, "user-agent": "danielsh-mcp", accept: "application/vnd.github+json" },
      });
      const user = (await userRes.json()) as { id?: number; login?: string; name?: string };
      if (!user.login || user.login.toLowerCase() !== env.ADMIN_GITHUB_LOGIN.toLowerCase()) {
        return page("Not allowed", `<h1>Not <em>allowed</em></h1><p>This server only accepts the site owner's GitHub account.</p>`, resumed.headers, 403);
      }

      const { redirectTo } = await oauth.completeAuthorization({
        request: resumed.request,
        userId: String(user.id),
        metadata: { label: user.login },
        scope: resumed.request.scope?.length ? resumed.request.scope : ["site:write"],
        props: { login: user.login, name: user.name ?? user.login, githubId: user.id! } satisfies Props,
      });
      return redirect(redirectTo, resumed.headers);
    }

    return new Response("Not found", { status: 404 });
  },
};
