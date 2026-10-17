import { renderBody, renderMeta, esc } from "../public/assets/render.js";
import { loadContent } from "../lib/content.js";

// Server-render "/" so the page is complete (and indexable) before any JS runs.
export async function onRequestGet({ request, env }) {
  const [shell, content] = await Promise.all([
    env.ASSETS.fetch(new URL("/", request.url)).then((r) => r.text()),
    loadContent(env, request),
  ]);
  const meta = renderMeta(content);
  const html = shell
    .replace(/<!--TITLE-->[\s\S]*?<!--\/TITLE-->/, esc(meta.title))
    .replace("<!--DESC-->", esc(meta.description))
    .replace("<!--APP-->", renderBody(content));
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
    },
  });
}
