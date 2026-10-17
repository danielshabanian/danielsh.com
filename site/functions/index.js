import { renderBody, renderMeta, esc } from "../public/assets/render.js";
import { loadContent } from "../lib/content.js";

// The zone's edge/browser cache can hold /assets/* for hours, so asset URLs carry a
// content hash: a deploy changes the URLs, and stale CSS can never meet new JS.
const ASSETS = ["/assets/styles.css", "/assets/app.js", "/assets/render.js"];
let version; // per isolate; a new deploy starts new isolates

async function assetVersion(env, request) {
  if (version) return version;
  const texts = await Promise.all(ASSETS.map((p) => env.ASSETS.fetch(new URL(p, request.url)).then((r) => r.text())));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texts.join("\n")));
  version = [...new Uint8Array(digest).slice(0, 5)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return version;
}

// Server-render "/" so the page is complete (and indexable) before any JS runs.
export async function onRequestGet({ request, env }) {
  const [shell, content, v] = await Promise.all([
    env.ASSETS.fetch(new URL("/", request.url)).then((r) => r.text()),
    loadContent(env, request),
    assetVersion(env, request),
  ]);
  const meta = renderMeta(content);
  const importMap = `<script type="importmap">${JSON.stringify({ imports: { "/assets/render.js": `/assets/render.js?v=${v}` } })}</script>`;
  const html = shell
    .replace(/<!--TITLE-->[\s\S]*?<!--\/TITLE-->/, esc(meta.title))
    .replace("<!--DESC-->", esc(meta.description))
    .replace('href="/assets/styles.css"', `href="/assets/styles.css?v=${v}"`)
    .replace('<script type="module" src="/assets/app.js"></script>', `${importMap}\n<script type="module" src="/assets/app.js?v=${v}"></script>`)
    .replace("<!--APP-->", renderBody(content));
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
    },
  });
}
