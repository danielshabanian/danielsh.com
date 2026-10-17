// Renders the page body from content.json. Shared by the Pages Function (server
// render at "/") and the browser (fallback when the function isn't available).

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// *word* -> <em>, | -> line break. Applied after escaping.
const rich = (s) => esc(s).replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/\|/g, "<br>");

const safeUrl = (u) => {
  const s = String(u ?? "").trim();
  if (!s) return "";
  if (/^(https?:|mailto:|#|\/)/i.test(s)) return s;
  return "";
};

const has = (v) => (Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== "");

const icon = {
  arrow: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  out: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>',
  down: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 4v12M6 11l6 6 6-6M5 20h14"/></svg>',
  auto: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  sun: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
};

function media(c, slug, cls, alt) {
  const m = slug && c.media && c.media[slug];
  const src = m && safeUrl(m.src);
  if (!src) return "";
  return `<figure class="${cls}"><img src="${esc(src)}" alt="${esc(m.alt || alt || "")}" loading="lazy" decoding="async"${m.width ? ` width="${+m.width}"` : ""}${m.height ? ` height="${+m.height}"` : ""}></figure>`;
}

function head(num, kicker, title) {
  return `<div class="sec-head"><span class="kicker" data-anim="kicker">${String(num).padStart(2, "0")} — ${esc(kicker).toUpperCase()}</span><h2 class="h2" data-anim="split">${rich(title)}</h2></div>`;
}

function link(l, cls, ic = icon.out) {
  const href = safeUrl(l && l.href);
  if (!href || !has(l.label)) return "";
  const ext = /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : "";
  return `<a class="${cls}" href="${esc(href)}"${ext}>${esc(l.label)} ${ic}</a>`;
}

const sections = {
  research(c, n) {
    const r = c.research;
    if (!r) return null;
    const f = r.featured;
    const metrics = (f?.metrics || []).filter((k) => has(k.value));
    const featured = f
      ? `<article class="featured card" data-anim="rise">
${media(c, f.slug, "frame frame-wide", f.title)}
<div class="featured-copy">
<div class="chips">${(f.tags || []).map((t, i) => `<span class="chip${i === 0 ? " chip-accent" : ""}">${esc(t).toUpperCase()}</span>`).join("")}</div>
<h3 class="h3-display">${esc(f.title)}</h3>
<p class="muted lede-s">${esc(f.body)}</p>
${link(f.link, "text-link")}
</div>
${metrics.length ? `<div class="metrics">${metrics.map((k) => `<div class="metric"><span class="label">${esc(k.label).toUpperCase()}</span><span class="metric-v" data-count="${esc(k.value)}">${esc(k.value)}</span><span class="muted small">${esc(k.note)}</span></div>`).join("")}</div>` : ""}
</article>`
      : "";
    const projects = (r.projects || [])
      .map(
        (p) => `<article class="project card" data-anim="card" data-tilt>
${media(c, p.slug, "frame", p.title)}
<div class="project-copy">
<span class="label accent">${esc(p.tag).toUpperCase()}</span>
<h3 class="h3">${esc(p.title)}</h3>
<p class="muted grow">${esc(p.body)}</p>
<span class="label muted">${esc(p.stack)}</span>
${link(p.link, "text-link")}
</div>
</article>`
      )
      .join("");
    return `<section id="research" class="section">${head(n, r.kicker, r.title)}${featured}${projects ? `<div class="grid-projects">${projects}</div>` : ""}</section>`;
  },

  publications(c, n) {
    const p = c.publications;
    if (!p || !has(p.items)) return null;
    const btn = (label, href) => (safeUrl(href) ? `<a class="pill" href="${esc(safeUrl(href))}" target="_blank" rel="noopener">${label}</a>` : "");
    const items = p.items
      .map((x) => {
        const doi = x.doi ? (/^https?:/i.test(x.doi) ? x.doi : `https://doi.org/${x.doi}`) : "";
        return `<li class="pub" data-anim="row">
<span class="label muted pub-year">${esc(x.year)}</span>
<div class="pub-main"><span class="pub-title">${esc(x.title)}</span><span class="muted">${esc(x.authors)}${x.venue ? ` · <em>${esc(x.venue)}</em>` : ""}</span></div>
<div class="pub-actions">${has(x.status) ? `<span class="pill pill-accent">${esc(x.status).toUpperCase()}</span>` : ""}${btn("PDF", x.pdf)}${btn("BibTeX", x.bibtex)}${btn("DOI", doi)}</div>
</li>`;
      })
      .join("");
    return `<section id="publications" class="section">${head(n, p.kicker, p.title)}<ol class="pubs">${items}</ol></section>`;
  },

  path(c, n) {
    const p = c.path;
    if (!p) return null;
    const skills = (p.skills || []).map((s) => `<span class="skill">${esc(s)}</span>`).join("");
    const tl = (p.timeline || [])
      .map(
        (t) => `<li class="tl-item" data-anim="tl"><span class="tl-dot" aria-hidden="true"></span>
<span class="label muted">${esc(t.when).toUpperCase()}</span>
<span class="tl-role">${esc(t.role)}</span>
<span class="accent">${esc(t.org)}</span>
${has(t.body) ? `<p class="muted tl-body">${esc(t.body)}</p>` : ""}
</li>`
      )
      .join("");
    return `<section id="path" class="section section-split">
<div class="path-side">${head(n, p.kicker, p.title)}<div class="skills">${skills}</div></div>
<ol class="timeline"><span class="tl-line" aria-hidden="true"></span>${tl}</ol>
</section>`;
  },

  life(c, n) {
    const l = c.life;
    if (!l || !has(l.items)) return null;
    const items = l.items
      .map(
        (h, i) => `<div class="life card" data-anim="card" data-tilt>
${media(c, h.slug, "frame", h.title)}
<span class="life-n">${String(i + 1).padStart(2, "0")}</span>
<span class="life-t">${esc(h.title)}</span>
<p class="muted">${esc(h.body)}</p>
</div>`
      )
      .join("");
    return `<section id="life" class="section">${head(n, l.kicker, l.title)}<div class="grid-life">${items}</div></section>`;
  },

  talks(c, n) {
    const t = c.talks;
    if (!t) return null;
    const f = t.featured;
    const feat = f
      ? `<article class="keynote" data-anim="rise">
${media(c, f.slug, "frame frame-talk", f.title)}
<span class="label accent">${esc(f.kicker).toUpperCase()}</span>
<h3 class="h3-display">${esc(f.title)}</h3>
<p class="keynote-body">${esc(f.body)}</p>
${link(f.link, "text-link")}
</article>`
      : "";
    const certs = (t.certs || [])
      .map((ce) => `<li class="cert" data-anim="row"><span class="cert-n">${esc(ce.name)}</span><span class="label muted">${esc(ce.org)} · ${esc(ce.year)}</span></li>`)
      .join("");
    return `<section id="talks" class="section">${head(n, t.kicker, t.title)}<div class="talks">${feat}${certs ? `<ul class="certs">${certs}</ul>` : ""}</div></section>`;
  },
};

const ORDER = ["research", "publications", "path", "life", "talks"];

// Hero instrument: a scoliotic spine (T9–L5) inside the robot's targeting rings.
// Everything is drawn around the viewBox centre (220, 220); app.js animates it.
export const VERTEBRAE = ["T9", "T10", "T11", "T12", "L1", "L2", "L3", "L4", "L5"].map((label, i, all) => {
  const t = i / (all.length - 1);
  const y = 112 + i * 27;
  const dx = 19 * Math.sin(2 * Math.PI * t); // the scoliotic S-curve, centred on the axis
  const slope = (19 * 2 * Math.PI * Math.cos(2 * Math.PI * t)) / ((all.length - 1) * 27);
  return { label, y, dx: +dx.toFixed(2), rot: +((Math.atan(slope) * 180) / Math.PI * 0.55).toFixed(2), w: Math.round(42 + i * 2.8), h: Math.round(16 + i * 0.7) };
});

function instrument() {
  const C = 220;
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const a = (i / 72) * Math.PI * 2;
    const r1 = i % 6 === 0 ? 188 : 193;
    const p = (r) => `${(C + r * Math.cos(a)).toFixed(1)} ${(C + r * Math.sin(a)).toFixed(1)}`;
    return `M${p(r1)}L${p(198)}`;
  }).join("");
  const verts = VERTEBRAE.map(
    (v) => `<g transform="translate(${C} ${v.y})"><g class="vert" data-label="${v.label}" transform="translate(${v.dx} 0) rotate(${v.rot})">
<rect class="vert-body" x="${-v.w / 2}" y="${-v.h / 2}" width="${v.w}" height="${v.h}" rx="${(v.h / 2.4).toFixed(1)}"/>
<path class="vert-proc" d="M${-v.w / 2} 0h-9M${v.w / 2} 0h9"/>
<text class="vert-label" x="${v.w / 2 + 16}" y="3.5">${v.label}</text>
</g></g>`
  ).join("");
  return `<div class="instrument">
<svg viewBox="0 0 440 440" width="100%" height="100%" role="img" aria-label="A robot's targeting rings scanning a curved spine, locking onto a vertebra and straightening the curve">
<defs>
<clipPath id="inst-clip"><circle cx="${C}" cy="${C}" r="150"/></clipPath>
<linearGradient id="inst-scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:0"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:.28"/></linearGradient>
</defs>
<g class="layer-back">
<path class="ring-ticks" d="${ticks}" stroke="var(--line)" stroke-width="1"/>
<g class="ring-outer"><circle cx="${C}" cy="${C}" r="210" fill="none" stroke="var(--line)" stroke-width="1" stroke-dasharray="1 7"/><path d="M${C} 6v14" stroke="var(--accent)" stroke-width="2"/></g>
<circle class="ring-mid" cx="${C}" cy="${C}" r="172" fill="none" stroke="var(--line)" stroke-width="1"/>
<g class="orbit"><circle cx="${C}" cy="${C - 172}" r="4.5" fill="var(--accent)"/></g>
<circle class="ring-inner" cx="${C}" cy="${C}" r="150" fill="none" stroke="var(--line)" stroke-width="1"/>
<path class="cross" d="M${C} 52v26M${C} 362v26M52 ${C}h26M362 ${C}h26" stroke="var(--muted)" stroke-width="1"/>
</g>
<g clip-path="url(#inst-clip)">
<line class="axis" x1="${C}" y1="88" x2="${C}" y2="352" stroke="var(--accent)" stroke-width="1" stroke-dasharray="3 5"/>
<g class="scan" transform="translate(0 80)"><rect x="60" y="-36" width="320" height="36" fill="url(#inst-scan)"/><line x1="60" y1="0" x2="380" y2="0" stroke="var(--accent)" stroke-width="1.25"/></g>
</g>
<g class="layer-front">
<g class="spine">${verts}</g>
<g class="reticle" transform="translate(${C + VERTEBRAE[5].dx} ${VERTEBRAE[5].y}) rotate(${VERTEBRAE[5].rot})">
<g class="ret-box" transform="scale(1)"><path d="M-46 -20v-8h12M46 -20v-8h-12M-46 20v8h12M46 20v8h-12" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/></g>
<circle r="2.5" fill="var(--accent)"/>
</g>
</g>
</svg>
<div class="hud label" aria-hidden="true">
<span class="hud-row"><span class="muted">TARGET</span> <span class="hud-target">L2</span></span>
<span class="hud-row"><span class="muted">STATE&nbsp;</span> <span class="hud-state accent">LOCKED</span></span>
<span class="hud-row"><span class="muted">TRUST&nbsp;</span> <span class="hud-trust">0.94</span></span>
</div>
</div>`;
}

export function renderBody(c) {
  const p = c.profile || {};
  const h = c.hero || {};
  let n = 0;
  const rendered = [];
  const nav = [];
  for (const key of ORDER) {
    const html = sections[key](c, n + 1);
    if (!html) continue;
    n += 1;
    rendered.push(html);
    nav.push(`<a href="#${key}">${esc(c[key].nav || key)}</a>`);
  }
  const cv = c.media && c.media.cv && safeUrl(c.media.cv.src);
  const email = String(p.email || "").trim();
  const socials = (p.socials || [])
    .filter((s) => safeUrl(s.url))
    .map((s) => `<a class="btn btn-ghost btn-lg" data-magnetic href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener">${esc(s.label)}</a>`)
    .join("");
  const marquee = (c.marquee || []).map((m) => `<span class="mq-item">${esc(m)}<span class="accent mq-star">✦</span></span>`).join("");

  return `<div class="progress" aria-hidden="true"></div>
<header class="nav">
<div class="wrap nav-in">
<a href="#top" class="brand"><span class="mono-badge">${esc(p.monogram || "")}</span><span class="brand-name">${esc(p.name)}</span></a>
<nav aria-label="Primary" class="nav-links">
${nav.join("\n")}
<div role="group" aria-label="Colour theme" class="theme">
<button type="button" data-theme-pick="auto" aria-label="Use system theme" title="Use system theme">${icon.auto}</button>
<button type="button" data-theme-pick="light" aria-label="Light theme" title="Light theme">${icon.sun}</button>
<button type="button" data-theme-pick="dark" aria-label="Dark theme" title="Dark theme">${icon.moon}</button>
</div>
<a href="#contact" class="btn btn-ink" data-magnetic>Get in touch</a>
</nav>
</div>
</header>
<main>
<section id="top" class="wrap hero">
<div class="hero-copy">
<div class="hero-kicker label" data-hero="kicker"><span class="pulse" aria-hidden="true"></span><span>${esc(h.kicker)}</span></div>
<h1 class="h1" data-hero="title">${rich(h.headline)}</h1>
<p class="hero-lede muted" data-hero="lede">${esc(h.lede)}</p>
<div class="hero-cta" data-hero="cta">
<a href="#research" class="btn btn-accent btn-lg" data-magnetic>See the research ${icon.arrow}</a>
${cv ? `<a href="${esc(cv)}" class="btn btn-ghost btn-lg" data-magnetic>Download CV ${icon.down}</a>` : ""}
</div>
</div>
<div class="hero-art" data-hero="art">${instrument()}</div>
</section>
${marquee ? `<div class="marquee" aria-hidden="true"><div class="mq-track">${marquee}${marquee}</div></div>` : ""}
<div class="wrap">
${rendered.join("\n")}
<section id="contact" class="section contact">
<span class="kicker" data-anim="kicker">${String(n + 1).padStart(2, "0")} — ${esc(c.contact?.kicker || "Contact").toUpperCase()}</span>
<h2 class="h-contact" data-anim="split">${rich(c.contact?.headline || "")}</h2>
<div class="contact-links" data-anim="rise">
${email ? `<a href="mailto:${esc(email)}" class="btn btn-accent btn-xl" data-magnetic>${esc(email)} ${icon.arrow}</a>` : ""}
${socials}
</div>
</section>
</div>
</main>
<footer class="foot"><div class="wrap foot-in label muted"><span>© ${new Date().getFullYear()} ${esc(p.name)}${p.location ? ` · ${esc(p.location)}` : ""}</span><span data-theme-label>Theme follows your system</span></div></footer>`;
}

export function renderMeta(c) {
  const s = c.seo || {};
  return { title: s.title || c.profile?.name || "", description: s.description || "" };
}

export { esc };
