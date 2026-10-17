import { loadContent } from "../../lib/content.js";

export async function onRequestGet({ request, env }) {
  const content = await loadContent(env, request);
  return Response.json(content, { headers: { "cache-control": "public, max-age=0, s-maxage=60" } });
}
