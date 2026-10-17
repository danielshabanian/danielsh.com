import { renderBody } from "./render.js";

const root = document.documentElement;
const app = document.getElementById("app");

// The Pages Function server-renders the body. If it didn't (static preview),
// render it here from the live content API, falling back to content.json.
async function ensureRendered() {
  if (app.firstElementChild) return;
  let content;
  try {
    content = await (await fetch("/api/content", { headers: { accept: "application/json" } })).json();
  } catch {
    content = await (await fetch("/content.json")).json();
  }
  app.innerHTML = renderBody(content);
}

/* ---------- theme: Auto / Light / Dark ---------- */
function initTheme() {
  const label = document.querySelector("[data-theme-label]");
  const buttons = [...document.querySelectorAll("[data-theme-pick]")];
  const read = () => {
    try { return localStorage.getItem("theme") || "auto"; } catch { return "auto"; }
  };
  const apply = (choice) => {
    if (choice === "auto") delete root.dataset.theme;
    else root.dataset.theme = choice;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themePick === choice)));
    if (label) label.textContent = choice === "auto" ? "Theme follows your system" : `${choice[0].toUpperCase()}${choice.slice(1)} theme`;
  };
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      const choice = b.dataset.themePick;
      try { choice === "auto" ? localStorage.removeItem("theme") : localStorage.setItem("theme", choice); } catch {}
      // Cross-fade the whole page between themes.
      if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        document.startViewTransition(() => apply(choice));
      } else apply(choice);
    })
  );
  apply(read());
}

/* ---------- active nav link ---------- */
function initNavSpy() {
  const links = new Map([...document.querySelectorAll('.nav-links a[href^="#"]:not(.btn)')].map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && links.forEach((a, id) => a.classList.toggle("is-active", id === e.target.id))),
    { rootMargin: "-45% 0px -50% 0px" }
  );
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

/* ---------- GSAP ---------- */
function initMotion() {
  const { gsap } = window;
  if (!gsap || !window.ScrollTrigger) { root.classList.remove("motion"); return; }
  const plugins = [window.ScrollTrigger, window.SplitText, window.DrawSVGPlugin, window.ScrambleTextPlugin].filter(Boolean);
  gsap.registerPlugin(...plugins);
  const ST = window.ScrollTrigger;
  const hasSplit = !!window.SplitText;
  window.__animReady = true;

  const mm = gsap.matchMedia();

  mm.add({ motion: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)", fine: "(hover: hover) and (pointer: fine)" }, (ctx) => {
    const { motion, fine } = ctx.conditions;
    if (!motion) {
      root.classList.remove("motion");
      gsap.set(".tl-line", { scaleY: 1 });
      return;
    }
    gsap.set("[data-hero], [data-anim]", { visibility: "visible" });

    /* scroll progress */
    gsap.to(".progress", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

    /* ---- hero intro timeline ---- */
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    const title = document.querySelector('[data-hero="title"]');
    if (hasSplit && title) {
      const split = window.SplitText.create(title, { type: "words,lines", linesClass: "split-line", mask: "lines" });
      tl.from(split.words, { yPercent: 110, rotate: 4, duration: 1.2, stagger: 0.06 }, 0.15);
    } else tl.from(title, { y: 40, opacity: 0, duration: 1 }, 0.15);
    tl.from('[data-hero="kicker"]', { y: 16, opacity: 0, duration: 0.9 }, 0)
      .from('[data-hero="lede"]', { y: 24, opacity: 0, duration: 1 }, 0.55)
      .from('[data-hero="cta"] > *', { y: 20, opacity: 0, duration: 0.9, stagger: 0.1 }, 0.7)
      .from(".nav", { yPercent: -100, duration: 1 }, 0);

    // Instrument: rings sweep in, vertebrae draw themselves, the trajectory traces, reticle locks.
    const art = document.querySelector('[data-hero="art"]');
    if (art) {
      tl.from(art, { scale: 0.85, opacity: 0, duration: 1.6 }, 0.2);
      if (window.DrawSVGPlugin) {
        tl.from(".instrument .ring-c, .instrument .ring-b circle:first-child", { drawSVG: "50% 50%", duration: 1.6, ease: "power3.inOut" }, 0.3)
          .from(".instrument .spine rect", { drawSVG: 0, duration: 0.9, stagger: 0.08, ease: "power2.inOut" }, 0.5)
          .from(".instrument .ticks", { drawSVG: "50% 50%", duration: 1 }, 0.6)
          .from(".instrument .trajectory", { drawSVG: 0, duration: 1.4, ease: "power2.inOut" }, 1.1);
      }
      tl.from(".instrument .reticle", { scale: 3, opacity: 0, rotate: 90, duration: 1, ease: "back.out(2)" }, 1.6);
      if (window.ScrambleTextPlugin) {
        document.querySelectorAll("[data-scramble]").forEach((el, i) => {
          tl.to(el, { duration: 1.2, scrambleText: { text: el.textContent, chars: "01<>/#·", revealDelay: 0.3, speed: 0.6 } }, 1.4 + i * 0.3);
        });
      }

      // Ambient motion.
      gsap.to(".instrument .ring-a", { rotate: 360, duration: 38, repeat: -1, ease: "none" });
      gsap.to(".instrument .ring-b", { rotate: -360, duration: 60, repeat: -1, ease: "none" });
      gsap.fromTo(".instrument .scan", { yPercent: -14000 }, { yPercent: 14000, duration: 4.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".instrument .reticle", { scale: 0.82, duration: 1.2, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 2.6 });

      // Scroll away: the instrument drifts and rotates as the hero leaves.
      gsap.to(".instrument", { yPercent: 18, rotate: 12, opacity: 0.25, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

      // Pointer parallax on the reticle and rings.
      if (fine) {
        const rx = gsap.quickTo(".instrument .reticle", "x", { duration: 0.8, ease: "power3" });
        const ry = gsap.quickTo(".instrument .reticle", "y", { duration: 0.8, ease: "power3" });
        const ix = gsap.quickTo(".instrument svg", "x", { duration: 1.2, ease: "power3" });
        const iy = gsap.quickTo(".instrument svg", "y", { duration: 1.2, ease: "power3" });
        const onMove = (e) => {
          const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
          rx(nx * 28); ry(ny * 28); ix(nx * -10); iy(ny * -10);
        };
        addEventListener("pointermove", onMove);
        ctx.add(() => () => removeEventListener("pointermove", onMove));
      }
    }

    /* ---- marquee: endless loop that speeds up with scroll velocity ---- */
    const track = document.querySelector(".mq-track");
    if (track) {
      const loop = gsap.to(track, { xPercent: -50, duration: 40, ease: "none", repeat: -1 });
      ST.create({
        onUpdate: (self) => {
          const v = self.getVelocity() / 300;
          const dir = self.direction;
          gsap.to(loop, { timeScale: dir * Math.min(6, Math.max(1, Math.abs(v))), duration: 0.2, overwrite: true });
          gsap.to(loop, { timeScale: dir, duration: 1.2, delay: 0.25, overwrite: false });
        },
      });
    }

    /* ---- section headings ---- */
    document.querySelectorAll('[data-anim="kicker"]').forEach((el) => {
      gsap.from(el, { x: -24, opacity: 0, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
    });
    document.querySelectorAll('[data-anim="split"]').forEach((el) => {
      if (hasSplit) {
        const s = window.SplitText.create(el, { type: "words,lines", linesClass: "split-line", mask: "lines" });
        gsap.from(s.words, { yPercent: 115, duration: 1.1, stagger: 0.04, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 85%" } });
      } else gsap.from(el, { y: 40, opacity: 0, duration: 1, scrollTrigger: { trigger: el, start: "top 85%" } });
    });

    /* ---- blocks ---- */
    document.querySelectorAll('[data-anim="rise"]').forEach((el) => {
      gsap.from(el, { y: 70, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 85%" } });
    });
    ST.batch('[data-anim="card"]', {
      start: "top 88%",
      once: true,
      onEnter: (els) => gsap.from(els, { y: 80, opacity: 0, rotateX: -12, transformPerspective: 900, duration: 1.1, stagger: 0.12, ease: "expo.out" }),
    });
    ST.batch('[data-anim="row"]', {
      start: "top 92%",
      once: true,
      onEnter: (els) => gsap.from(els, { y: 30, opacity: 0, duration: 0.8, stagger: 0.07, ease: "power3.out" }),
    });

    // Chips and skills pop in.
    document.querySelectorAll(".chips, .skills").forEach((g) => {
      gsap.from(g.children, { scale: 0.6, opacity: 0, duration: 0.6, stagger: 0.03, ease: "back.out(2)", scrollTrigger: { trigger: g, start: "top 90%" } });
    });

    // Featured image: slow zoom-out parallax inside its frame.
    document.querySelectorAll(".frame img").forEach((img) => {
      gsap.fromTo(img, { scale: 1.18, yPercent: -6 }, { scale: 1, yPercent: 6, ease: "none", scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
    });

    // Numeric metrics count up.
    document.querySelectorAll("[data-count]").forEach((el) => {
      const m = el.dataset.count.match(/^([^\d-]*)(-?[\d.]+)(.*)$/);
      if (!m) return;
      const end = parseFloat(m[2]), dec = (m[2].split(".")[1] || "").length, o = { v: 0 };
      gsap.to(o, { v: end, duration: 1.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%" }, onUpdate: () => (el.textContent = `${m[1]}${o.v.toFixed(dec)}${m[3]}`) });
    });

    /* ---- timeline: the accent line draws with scroll, dots light up ---- */
    const timeline = document.querySelector(".timeline");
    if (timeline) {
      gsap.to(".tl-line", { scaleY: 1, ease: "none", scrollTrigger: { trigger: timeline, start: "top 70%", end: "bottom 60%", scrub: 0.4 } });
      timeline.querySelectorAll(".tl-item").forEach((li) => {
        const dot = li.querySelector(".tl-dot");
        gsap.timeline({ scrollTrigger: { trigger: li, start: "top 72%" } })
          .from(li, { x: 40, opacity: 0, duration: 0.9, ease: "expo.out" })
          .fromTo(dot, { scale: 0 }, { scale: 1, duration: 0.5, ease: "back.out(3)" }, 0.1)
          .to(dot, { backgroundColor: "var(--accent)", duration: 0.3 }, 0.4);
      });
    }

    /* ---- life numbers ---- */
    document.querySelectorAll(".life-n").forEach((el) => {
      gsap.from(el, { yPercent: 60, opacity: 0, rotate: -8, duration: 1, ease: "back.out(1.6)", scrollTrigger: { trigger: el, start: "top 90%" } });
    });

    /* ---- contact headline: letters fall into place ---- */
    const hc = document.querySelector(".h-contact");
    if (hc && hasSplit) {
      // The generic split above already handles words; add a subtle skew on scroll.
      gsap.fromTo(hc, { skewY: 3 }, { skewY: 0, ease: "none", scrollTrigger: { trigger: hc, start: "top bottom", end: "center center", scrub: true } });
    }

    /* ---- pointer niceties (desktop) ---- */
    if (fine) {
      // Magnetic buttons.
      document.querySelectorAll("[data-magnetic]").forEach((el) => {
        const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" });
        const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });
        el.addEventListener("pointermove", (e) => {
          const r = el.getBoundingClientRect();
          x((e.clientX - r.left - r.width / 2) * 0.3);
          y((e.clientY - r.top - r.height / 2) * 0.4);
        });
        el.addEventListener("pointerleave", () => { x(0); y(0); });
      });
      // Tilt cards.
      document.querySelectorAll("[data-tilt]").forEach((el) => {
        const rx = gsap.quickTo(el, "rotationX", { duration: 0.6, ease: "power3" });
        const ry = gsap.quickTo(el, "rotationY", { duration: 0.6, ease: "power3" });
        gsap.set(el, { transformPerspective: 1000 });
        el.addEventListener("pointermove", (e) => {
          const r = el.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 8);
          rx(((e.clientY - r.top) / r.height - 0.5) * -8);
        });
        el.addEventListener("pointerleave", () => { rx(0); ry(0); });
      });
      // Cursor dot that grows over links.
      const cur = document.querySelector(".cursor");
      if (cur) {
        const cx = gsap.quickTo(cur, "x", { duration: 0.25, ease: "power3" });
        const cy = gsap.quickTo(cur, "y", { duration: 0.25, ease: "power3" });
        const onMove = (e) => { cx(e.clientX); cy(e.clientY); gsap.to(cur, { opacity: 1, duration: 0.3, overwrite: "auto" }); };
        const onOver = (e) => gsap.to(cur, { scale: e.target.closest("a, button") ? 4 : 1, duration: 0.3, overwrite: "auto" });
        addEventListener("pointermove", onMove);
        addEventListener("pointerover", onOver);
        ctx.add(() => () => { removeEventListener("pointermove", onMove); removeEventListener("pointerover", onOver); });
      }
    }
  });

  // Fonts change line breaks; re-measure once they're in.
  document.fonts?.ready.then(() => ST.refresh());
}

await ensureRendered();
initTheme();
initNavSpy();
initMotion();
