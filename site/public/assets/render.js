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
<div class="hero-art" data-hero="art">
<div class="instrument">
<svg viewBox="0 0 440 440" width="100%" height="100%" role="img" aria-label="Line drawing of a vertebral column inside a robot's targeting rings">
<g class="ring-a"><circle cx="220" cy="220" r="200" fill="none" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 10"/></g>
<g class="ring-b"><circle cx="220" cy="220" r="168" fill="none" stroke="var(--line)" stroke-width="1"/><circle cx="220" cy="52" r="5" fill="var(--accent)"/><circle cx="388" cy="220" r="3" fill="var(--ink)"/></g>
<circle class="ring-c" cx="220" cy="220" r="120" fill="none" stroke="var(--line)" stroke-width="1"/>
<path class="ticks" d="M220 20v40M220 380v40M20 220h40M380 220h40" stroke="var(--muted)" stroke-width="1"/>
<g class="spine" fill="none" stroke="var(--ink)" stroke-width="1.5">
<rect x="196" y="112" width="48" height="22" rx="8"/><rect x="190" y="142" width="56" height="24" rx="9"/><rect x="186" y="174" width="62" height="26" rx="10"/><rect x="186" y="208" width="64" height="27" rx="10"/><rect x="190" y="243" width="62" height="27" rx="10"/><rect x="196" y="278" width="58" height="26" rx="10"/><rect x="202" y="312" width="52" height="24" rx="9"/>
</g>
<path class="trajectory" d="M220 100 C 236 160, 204 230, 228 340" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="4 6"/>
<g class="reticle"><circle cx="218" cy="221" r="9" fill="none" stroke="var(--accent)" stroke-width="2"/><path d="M218 196v12M218 234v12M193 221h12M231 221h12" stroke="var(--accent)" stroke-width="2"/></g>
</svg>
<div class="scan" aria-hidden="true"></div>
<div class="hud label muted" aria-hidden="true">${(h.hud || []).map((x) => `<span data-scramble>${esc(x)}</span>`).join("<br>")}</div>
</div>
</div>
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
