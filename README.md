# danielsh.com

Personal site of Danial Shabanian — PhD researcher building trustworthy autonomy for spinal surgery (MEDRG, Nottingham Trent University).

- **Site:** https://danielsh.com (also `www.`) — Cloudflare Pages
- **Admin MCP server:** https://danielsh.com/mcp — Cloudflare Worker, OAuth 2.1, GitHub sign-in (owner only)
- **Contact:** me@danielsh.com → forwarded by Cloudflare Email Routing

## How it fits together

```
                 danielsh.com
                      │
     ┌────────────────┴─────────────────┐
     │ Worker routes (mcp/)             │ everything else → Pages (site/)
     │   /mcp*                          │   /            server-rendered from content
     │   /oauth/*                       │   /api/content live content as JSON
     │   /.well-known/oauth-*           │   /assets/*    CSS, GSAP layer, renderer
     └────────────────┬─────────────────┘   /media/*     images committed to this repo
                      │                                   │
                      └──────── KV: SITE_CONTENT ─────────┘
                         key "content" (+ "history:*" versions)
```

The page content is one JSON document. Until the first edit it comes from
[`site/public/content.json`](site/public/content.json); once you edit through the
MCP server, the live copy lives in KV and every change keeps the previous version.

## Repository layout

| Path | What it is |
| --- | --- |
| `site/public/index.html` | Page shell. `<!--APP-->` is replaced by the rendered body. |
| `site/public/content.json` | Default content (from LinkedIn + the design). |
| `site/public/assets/render.js` | Renders the body from content. Shared by the server and the browser. Also draws the hero instrument. |
| `site/public/assets/app.js` | Theme switch (Auto / Light / Dark) and all GSAP animation. |
| `site/public/assets/styles.css` | Design tokens and layout; dark/light follow `prefers-color-scheme`. |
| `site/public/media/` | Images (and `cv.pdf`) shown on the site. |
| `site/functions/` | Pages Functions: server render of `/`, `/api/content`. |
| `site/wrangler.toml` | Pages project config (KV binding). |
| `mcp/src/index.ts` | MCP server (tools) + OAuth provider config. |
| `mcp/src/auth.ts` | Consent page, GitHub sign-in, owner check. |
| `mcp/src/schema.ts` | Zod schema every content edit is validated against. |
| `mcp/src/store.ts` | KV read/write with version history. |
| `mcp/wrangler.jsonc` | Worker config: routes, KV, Durable Object, vars. |

## Design and animation

From the *Danial Shabanian* design system: Instrument Serif / Instrument Sans /
JetBrains Mono, one accent colour (`#FF6B3D` dark, `#C2410C` light).

Animation is [GSAP 3.13](https://gsap.com) (ScrollTrigger, SplitText, DrawSVG,
ScrambleText) loaded from jsDelivr:

- **Hero instrument** — a scoliotic spine (T9–L5) in the robot's targeting rings, on a loop:
  scan → search T12 → L1 → lock L2 (trust 0.31 → 0.94) → straighten the curve → reset.
  The pointer tilts it in 3D.
- Headline words rise through line masks; section titles split on scroll.
- Marquee speeds up with scroll velocity; timeline line draws as you scroll.
- Magnetic buttons, tilting cards, cursor dot (mouse only).
- `prefers-reduced-motion` turns all of it off; if the CDN fails, content shows after 3 s.

## Editing content

### With the MCP server (recommended)

Add a custom connector in Claude (or any MCP client) with URL
`https://danielsh.com/mcp`. It opens a consent page, then GitHub; only the GitHub
account `danielshabanian` gets a token.

| Tool | Use |
| --- | --- |
| `get_content` | Read everything or one section. |
| `set_field` | Set a value by path, e.g. `profile.email`, `hero.headline`, `research.featured.metrics.0.value`. |
| `replace_section` | Replace a whole section. |
| `add_item` / `update_item` / `remove_item` / `move_item` | Edit lists: projects, publications, timeline, skills, interests, certificates, socials, metrics, marquee. |
| `set_media` / `clear_media` / `list_media` | Point an image slot at a file in `site/public/media/` (or an https URL). |
| `list_versions` / `restore_version` | Undo. `restore_version("defaults")` goes back to `content.json`. |
| `site_info` | Where things live, who you're signed in as. |

Edits are live straight away (the edge caches the page for up to 60 s).
In headlines, `*word*` renders as the accent italic; `|` in the contact headline is a line break.
Empty values are hidden on the page — e.g. ScoliBot's metrics only appear once they have values.

### Images

Commit the file to `site/public/media/`, deploy, then point a slot at it:

```
set_media  slug: "scolibot"  src: "/media/scolibot.jpg"  alt: "ScoliBot in the lab"
```

Slots: `scolibot` (featured hero), each project's `slug`, `nspine-keynote`, any
`life` item with a `slug`, and `cv` (a PDF — shows the *Download CV* button).
A slot with nothing in it isn't rendered.

### By hand

Edit `site/public/content.json` and deploy. Note that once anything has been edited
through MCP, the KV copy wins; use `restore_version("defaults")` after deploying if
you want the file to take over again.

## Local development

Requires Node 20+. On Windows PowerShell, use `npx.cmd` (script execution policy blocks `npx.ps1`).

```bash
npm install
```

```bash
cd site && npx wrangler pages dev --port 8788
```

Open http://localhost:8788. For the MCP server:

```bash
cd mcp && npm install && npx tsc -p . && npx wrangler dev
```

## Deploying

Logged in with `npx wrangler login` first.

```bash
cd site && npx wrangler pages deploy --branch main
```

```bash
cd mcp && npx wrangler deploy
```

There is no Git integration: pushing to GitHub does not deploy.

## Infrastructure

| Thing | Value |
| --- | --- |
| Pages project | `danielsh` (custom domains `danielsh.com`, `www.danielsh.com`) |
| Worker | `danielsh-mcp` (routes on `danielsh.com`: `/mcp*`, `/oauth/*`, `/.well-known/oauth-*`) |
| KV `SITE_CONTENT` | Content + version history, bound in both Pages and the Worker (id in the wrangler configs) |
| KV `MCP_OAUTH` | OAuth clients, grants, tokens |
| GitHub OAuth App | *danielsh.com site admin (MCP)*, callback `https://danielsh.com/oauth/callback`; its public client ID is in `mcp/wrangler.jsonc` |
| Worker secret | `GITHUB_CLIENT_SECRET` — never committed; set or rotate with `npx wrangler secret put GITHUB_CLIENT_SECRET` in `mcp/` |
| Email Routing | `me@danielsh.com` → a private inbox |

The IDs in `site/wrangler.toml` and `mcp/wrangler.jsonc` (KV namespaces, OAuth client ID)
are identifiers, not credentials: nothing can be read or changed with them without a
Cloudflare login or the client secret.

### Forking this

Create your own KV namespaces (`npx wrangler kv namespace create …`) and GitHub OAuth
App, then replace the IDs in both wrangler configs, `ADMIN_GITHUB_LOGIN`, `SITE_URL`,
the routes/`resource` (`mcp/src/index.ts`) and `site/public/content.json`.

### Security notes

- The consent page shows the client's name and where tokens go, and warns for local redirects. Dynamically registered clients expire after 90 days.
- Every MCP tool re-checks that the token belongs to `ADMIN_GITHUB_LOGIN`.
- Content writes are validated against `mcp/src/schema.ts`; URLs in content are limited to `https:`, `mailto:`, `#` and `/`.
- To lock everyone out, rotate the GitHub client secret, or revoke the app at github.com → Settings → Applications.
