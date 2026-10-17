import defaults from "../../site/public/content.json";
import { Content, type ContentDoc } from "./schema";

const KEY = "content";
const HISTORY_PREFIX = "history:";
const HISTORY_TTL = 60 * 60 * 24 * 90; // keep 90 days of versions

export async function readContent(env: Env): Promise<ContentDoc> {
  const live = await env.SITE.get(KEY, "json");
  return Content.parse(live ?? defaults);
}

/** Validate, snapshot the previous version, then write. Returns the saved doc. */
export async function writeContent(env: Env, next: unknown, note: string): Promise<ContentDoc> {
  const parsed = Content.safeParse(next);
  if (!parsed.success) {
    throw new Error(`Content failed validation:\n${parsed.error.issues.map((i) => `• ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  const prev = await env.SITE.get(KEY);
  if (prev) {
    const id = `${HISTORY_PREFIX}${new Date().toISOString()}`;
    await env.SITE.put(id, prev, { expirationTtl: HISTORY_TTL, metadata: { note } });
  }
  await env.SITE.put(KEY, JSON.stringify(parsed.data));
  return parsed.data;
}

export async function listHistory(env: Env, limit = 20) {
  const out: { id: string; note: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.SITE.list<{ note?: string }>({ prefix: HISTORY_PREFIX, cursor });
    for (const k of page.keys) out.push({ id: k.name, note: k.metadata?.note ?? "" });
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out.sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, limit);
}

export async function readVersion(env: Env, id: string): Promise<unknown | null> {
  if (!id.startsWith(HISTORY_PREFIX)) return null;
  return env.SITE.get(id, "json");
}

export const defaultContent = defaults;

/** Get/set by a dotted path like "profile.email" or "research.projects.0.title". */
export function getPath(obj: any, path: string): any {
  return path.split(".").filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setPath(obj: any, path: string, value: unknown) {
  const keys = path.split(".").filter(Boolean);
  if (!keys.length) throw new Error("Empty path");
  if (keys.some((k) => k === "__proto__" || k === "constructor" || k === "prototype")) throw new Error("Invalid path");
  let o = obj;
  for (const [i, k] of keys.slice(0, -1).entries()) {
    if (o[k] == null) o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[k];
  }
  o[keys[keys.length - 1]] = value;
}
