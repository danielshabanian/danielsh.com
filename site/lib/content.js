// Live content lives in KV (written by the MCP server). Until the first edit,
// the bundled public/content.json is the source.
export const CONTENT_KEY = "content";

export async function loadContent(env, request) {
  if (env.SITE) {
    const live = await env.SITE.get(CONTENT_KEY, "json");
    if (live) return live;
  }
  const res = await env.ASSETS.fetch(new URL("/content.json", request.url));
  return res.json();
}
