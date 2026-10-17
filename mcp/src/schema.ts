import { z } from "zod";

// The site's content document. Mirrors site/public/content.json; the renderer
// (site/public/assets/render.js) hides anything left empty.
const str = z.string().max(4000);
const short = z.string().max(300);
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "lowercase letters, digits and dashes");
const link = z.object({ label: short.default(""), href: short.default("") });

export const Metric = z.object({ label: short, value: short.default(""), note: short.default("") });
export const Project = z.object({ slug, tag: short.default(""), title: short, body: str.default(""), stack: short.default(""), link: link.optional() });
export const Publication = z.object({
  year: short.default(""), title: short, authors: short.default(""), venue: short.default(""), status: short.default(""),
  pdf: short.default(""), bibtex: short.default(""), doi: short.default(""),
});
export const TimelineEntry = z.object({ when: short, role: short, org: short.default(""), body: str.default("") });
export const LifeItem = z.object({ slug: slug.optional(), title: short, body: str.default("") });
export const Cert = z.object({ name: short, org: short.default(""), year: short.default("") });
export const MediaEntry = z.object({
  src: short, alt: short.default(""), width: z.number().int().positive().optional(), height: z.number().int().positive().optional(),
});

const sectionBase = { nav: short.default(""), kicker: short.default(""), title: short.default("") };

export const Content = z.object({
  profile: z.object({
    name: short, monogram: z.string().max(4).default(""), location: short.default(""), email: short.default(""),
    socials: z.array(z.object({ label: short, url: short })).max(12).default([]),
  }),
  seo: z.object({ title: short.default(""), description: short.default("") }).default({ title: "", description: "" }),
  hero: z.object({ kicker: short.default(""), headline: short, lede: str.default(""), hud: z.array(short).max(4).default([]) }),
  marquee: z.array(short).max(24).default([]),
  research: z.object({
    ...sectionBase,
    featured: z.object({ slug, tags: z.array(short).max(8).default([]), title: short, body: str.default(""), link: link.optional(), metrics: z.array(Metric).max(8).default([]) }).optional(),
    projects: z.array(Project).max(40).default([]),
  }).optional(),
  publications: z.object({ ...sectionBase, items: z.array(Publication).max(200).default([]) }).optional(),
  path: z.object({ ...sectionBase, skills: z.array(short).max(60).default([]), timeline: z.array(TimelineEntry).max(60).default([]) }).optional(),
  life: z.object({ ...sectionBase, items: z.array(LifeItem).max(24).default([]) }).optional(),
  talks: z.object({
    ...sectionBase,
    featured: z.object({ slug, kicker: short.default(""), title: short, body: str.default(""), link: link.optional() }).optional(),
    certs: z.array(Cert).max(80).default([]),
  }).optional(),
  contact: z.object({ kicker: short.default("Contact"), headline: short.default("") }).optional(),
  media: z.record(slug, MediaEntry).default({}),
});

export type ContentDoc = z.infer<typeof Content>;

// Lists that the add/remove tools can address, with the schema for one item.
export const LISTS = {
  "research.projects": Project,
  "research.featured.metrics": Metric,
  "publications.items": Publication,
  "path.timeline": TimelineEntry,
  "path.skills": short,
  "life.items": LifeItem,
  "talks.certs": Cert,
  "marquee": short,
  "profile.socials": z.object({ label: short, url: short }),
  "hero.hud": short,
} as const;
export type ListPath = keyof typeof LISTS;

export const SECTIONS = ["profile", "seo", "hero", "marquee", "research", "publications", "path", "life", "talks", "contact"] as const;
