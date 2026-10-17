import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { authHandler, type Props } from "./auth";
import { LISTS, SECTIONS, type ListPath } from "./schema";
import { defaultContent, getPath, listHistory, readContent, readVersion, setPath, writeContent } from "./store";


const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const json = (v: unknown) => text(JSON.stringify(v, null, 2));
const fail = (e: unknown) => ({ ...text(e instanceof Error ? e.message : String(e)), isError: true });

export class SiteMCP extends McpAgent<Env, unknown, Props> {
  server = new McpServer({ name: "danielsh.com site admin", version: "1.0.0" });

  /** Defence in depth: the OAuth flow only issues tokens to the admin, but check again. */
  private assertAdmin() {
    const login = this.props?.login?.toLowerCase();
    if (!login || login !== this.env.ADMIN_GITHUB_LOGIN.toLowerCase()) throw new Error("Not authorised");
  }

  private tool<S extends z.ZodRawShape>(name: string, description: string, shape: S, run: (args: z.infer<z.ZodObject<S>>) => Promise<ReturnType<typeof text>>) {
    this.server.registerTool(name, { description, inputSchema: shape }, (async (args: z.infer<z.ZodObject<S>>) => {
      try {
        this.assertAdmin();
        return await run(args);
      } catch (e) {
        return fail(e);
      }
    }) as any);
  }

  async init() {
    const env = this.env;
    const listPaths = Object.keys(LISTS) as [ListPath, ...ListPath[]];

    this.tool("get_content", "Read the live website content (whole document, or one top-level section).", {
      section: z.enum(SECTIONS).optional().describe("Omit for the whole document"),
    }, async ({ section }) => {
      const c = await readContent(env);
      return json(section ? (c as any)[section] : c);
    });

    this.tool("set_field", "Set one value by dotted path, e.g. profile.email, hero.headline, research.projects.0.body. Wrap a word in *asterisks* in headlines for the accent italic; | in the contact headline is a line break.", {
      path: z.string().min(1).max(200),
      value: z.any().describe("String, number, object or array"),
    }, async ({ path, value }) => {
      const c: any = await readContent(env);
      setPath(c, path, value);
      await writeContent(env, c, `set ${path}`);
      return text(`Updated ${path}. Live at ${env.SITE_URL} within about a minute.`);
    });

    this.tool("replace_section", "Replace a whole top-level section with a new object (validated). Use get_content first to see its shape.", {
      section: z.enum(SECTIONS),
      value: z.any(),
    }, async ({ section, value }) => {
      const c: any = await readContent(env);
      c[section] = value;
      await writeContent(env, c, `replace ${section}`);
      return text(`Replaced ${section}.`);
    });

    this.tool("add_item", "Add an item to a list: a project, publication, timeline entry, skill, interest, certificate, social link, metric, marquee word or hero HUD line.", {
      list: z.enum(listPaths),
      item: z.any().describe("Object (or string for skills/marquee/hud) matching the list's item shape"),
      position: z.number().int().min(0).optional().describe("Index to insert at; omit to append (publications/timeline: 0 = top)"),
    }, async ({ list, item, position }) => {
      const parsed = (LISTS[list] as z.ZodTypeAny).safeParse(item);
      if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join(".") || "item"}: ${i.message}`).join("\n"));
      const c: any = await readContent(env);
      const arr: unknown[] = getPath(c, list) ?? [];
      arr.splice(position ?? arr.length, 0, parsed.data);
      setPath(c, list, arr);
      await writeContent(env, c, `add to ${list}`);
      return text(`Added to ${list} (now ${arr.length} items).`);
    });

    this.tool("update_item", "Merge fields into one list item by index.", {
      list: z.enum(listPaths),
      index: z.number().int().min(0),
      fields: z.record(z.string(), z.any()),
    }, async ({ list, index, fields }) => {
      const c: any = await readContent(env);
      const arr: any[] = getPath(c, list) ?? [];
      if (!arr[index]) throw new Error(`No item ${index} in ${list}`);
      arr[index] = typeof arr[index] === "object" ? { ...arr[index], ...fields } : fields.value;
      await writeContent(env, c, `update ${list}.${index}`);
      return text(`Updated ${list}[${index}].`);
    });

    this.tool("remove_item", "Remove one list item by index.", {
      list: z.enum(listPaths),
      index: z.number().int().min(0),
    }, async ({ list, index }) => {
      const c: any = await readContent(env);
      const arr: unknown[] = getPath(c, list) ?? [];
      if (index >= arr.length) throw new Error(`No item ${index} in ${list}`);
      const [gone] = arr.splice(index, 1);
      await writeContent(env, c, `remove ${list}.${index}`);
      return json({ removed: gone });
    });

    this.tool("move_item", "Reorder a list item.", {
      list: z.enum(listPaths),
      from: z.number().int().min(0),
      to: z.number().int().min(0),
    }, async ({ list, from, to }) => {
      const c: any = await readContent(env);
      const arr: unknown[] = getPath(c, list) ?? [];
      if (from >= arr.length) throw new Error(`No item ${from} in ${list}`);
      arr.splice(Math.min(to, arr.length - 1), 0, ...arr.splice(from, 1));
      await writeContent(env, c, `move ${list} ${from}->${to}`);
      return text(`Moved ${list}[${from}] to ${to}.`);
    });

    this.tool("set_media", "Show an image (or the CV PDF) in a slot. Images live in the GitHub repo under site/public/media/; pass its site path (e.g. /media/scolibot.jpg) or any https URL. Slots: 'scolibot' (featured hero), a project's slug, 'nspine-keynote', a life item's slug, or 'cv' for the Download CV button. Empty slots stay hidden on the site.", {
      slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
      src: z.string().regex(/^(\/media\/[\w.-]+|https:\/\/\S+)$/, "a /media/<file> path or https URL"),
      alt: z.string().max(300).optional().describe("Alt text for images"),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
    }, async ({ slug, src, alt, width, height }) => {
      const c: any = await readContent(env);
      c.media = { ...(c.media ?? {}), [slug]: { src, alt: alt ?? "", width, height } };
      await writeContent(env, c, `set media ${slug}`);
      return text(`Slot ${slug} now shows ${src}.`);
    });

    this.tool("clear_media", "Empty a slot; its frame disappears from the site.", {
      slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
    }, async ({ slug }) => {
      const c: any = await readContent(env);
      if (c.media) delete c.media[slug];
      await writeContent(env, c, `clear media ${slug}`);
      return text(`Cleared ${slug}.`);
    });

    this.tool("list_media", "List media slots and what is stored in each, plus the slugs that could take an image.", {}, async () => {
      const c: any = await readContent(env);
      const slots = [
        c.research?.featured?.slug,
        ...(c.research?.projects ?? []).map((p: any) => p.slug),
        c.talks?.featured?.slug,
        ...(c.life?.items ?? []).map((l: any) => l.slug).filter(Boolean),
        "cv",
      ].filter(Boolean);
      return json({ filled: c.media ?? {}, available_slots: slots });
    });

    this.tool("list_versions", "List previous versions of the content (newest first). Every change saves one.", {
      limit: z.number().int().min(1).max(100).optional(),
    }, async ({ limit }) => json(await listHistory(env, limit ?? 20)));

    this.tool("restore_version", "Restore a previous version by id from list_versions, or 'defaults' for the original LinkedIn-based content.", {
      id: z.string(),
    }, async ({ id }) => {
      const doc = id === "defaults" ? { ...defaultContent, media: (await readContent(env)).media } : await readVersion(env, id);
      if (!doc) throw new Error(`No version ${id}`);
      await writeContent(env, doc, `restore ${id}`);
      return text(`Restored ${id}.`);
    });

    this.tool("site_info", "Where the site lives and how edits propagate.", {}, async () =>
      json({
        site: env.SITE_URL,
        content_api: `${env.SITE_URL}/api/content`,
        note: "Edits are live immediately in KV; the edge caches the page for up to 60 seconds.",
        signed_in_as: this.props?.login,
      })
    );
  }
}

export default new OAuthProvider({
  apiHandlers: { "/mcp": SiteMCP.serve("/mcp") as any },
  defaultHandler: authHandler as any,
  // Served on danielsh.com itself: Worker routes take /mcp*, /oauth/* and
  // /.well-known/oauth-*; Pages serves everything else.
  authorizeEndpoint: "/oauth/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/oauth/register",
  scopesSupported: ["site:write"],
  resourceMetadata: { resource: "https://danielsh.com/mcp", resource_name: "danielsh.com site admin" },
  accessTokenTTL: 60 * 60,
  refreshTokenTTL: 60 * 60 * 24 * 30,
});
