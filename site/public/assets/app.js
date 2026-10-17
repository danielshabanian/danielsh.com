import { renderBody, VERTEBRAE } from "./render.js";

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

/* ---------- hero instrument ---------- */
function initInstrument(gsap, intro, art, fine, ctx) {
  const C = 220;
  const $ = (s) => art.querySelector(s);
  const verts = [...art.querySelectorAll(".vert")];
  const reticle = $(".reticle"), box = $(".ret-box"), scan = $(".scan"), axis = $(".axis");
  const hudTarget = $(".hud-target"), hudState = $(".hud-state"), hudTrust = $(".hud-trust");
  const at = (label) => VERTEBRAE.findIndex((v) => v.label === label);
  const curve = (v) => `translate(${v.dx} 0) rotate(${v.rot})`;
  const straight = "translate(0 0) rotate(0)";
  const retAt = (v, aligned) => `translate(${C + (aligned ? 0 : v.dx)} ${v.y}) rotate(${aligned ? 0 : v.rot})`;
  const say = (el, text) => () => {
    if (window.ScrambleTextPlugin) gsap.to(el, { duration: 0.6, scrambleText: { text, chars: "01<>/#", speed: 0.8 }, overwrite: true });
    else el.textContent = text;
  };
  const trust = { v: 0 };
  const showTrust = () => (hudTrust.textContent = trust.v.toFixed(2));
  const L2 = VERTEBRAE[at("L2")];

  // Starting state for the loop.
  gsap.set(reticle, { opacity: 0, attr: { transform: retAt(VERTEBRAE[at("T12")]) } });
  gsap.set(axis, { opacity: 0 });
  hudTarget.textContent = "—"; hudState.textContent = "STANDBY"; showTrust();

  /* intro: rings draw, ticks fade, vertebrae stack top-down */
  intro.from(art, { opacity: 0, scale: 0.92, duration: 1.4 }, 0.2);
  if (window.DrawSVGPlugin) {
    intro.from(art.querySelectorAll(".ring-inner, .ring-mid, .ring-outer circle"), { drawSVG: "50% 50%", duration: 1.6, stagger: 0.12, ease: "power3.inOut" }, 0.25)
      .from(art.querySelectorAll(".vert-body"), { drawSVG: "50% 50%", duration: 0.7, stagger: 0.06, ease: "power2.out" }, 0.6);
  }
  intro.from(".instrument .ring-ticks, .instrument .cross", { opacity: 0, duration: 1 }, 0.5)
    .from(art.querySelectorAll(".vert-part, .vert-disc"), { opacity: 0, duration: 0.5, stagger: 0.015 }, 0.9)
    .from(".instrument .sacrum", { opacity: 0, duration: 0.6 }, 1.3)
    .from(".instrument .hud", { x: -16, opacity: 0, duration: 0.8 }, 1.3);

  /* ambient: rings turn about the true centre */
  gsap.to(".instrument .ring-outer", { rotation: 360, svgOrigin: `${C} ${C}`, duration: 80, repeat: -1, ease: "none" });
  gsap.to(".instrument .ring-ticks", { rotation: -360, svgOrigin: `${C} ${C}`, duration: 140, repeat: -1, ease: "none" });
  gsap.to(".instrument .orbit", { rotation: 360, svgOrigin: `${C} ${C}`, duration: 14, repeat: -1, ease: "none" });

  /* the loop */
  const loop = gsap.timeline({ repeat: -1, paused: true, defaults: { ease: "power3.inOut" } });
  const hit = (on) => verts.forEach((el, i) => el.classList.toggle("is-hit", on === i));
  const scanPos = { y: 70 };
  loop
    .call(say(hudState, "SCANNING")).call(say(hudTarget, "—"))
    .set(scan, { opacity: 1 })
    .fromTo(scanPos, { y: 70 }, {
      y: 372, duration: 2.4, ease: "sine.inOut",
      onUpdate: () => {
        scan.setAttribute("transform", `translate(0 ${scanPos.y.toFixed(1)})`);
        const i = VERTEBRAE.findIndex((v) => Math.abs(v.y - scanPos.y) < 11);
        hit(i);
      },
    })
    .to(scan, { opacity: 0, duration: 0.3 }).call(() => hit(-1))
    // hunt: T12 -> L1 -> L2
    .call(say(hudState, "SEARCHING")).call(say(hudTarget, "T12"))
    .fromTo(reticle, { opacity: 0 }, { opacity: 1, duration: 0.3 })
    .fromTo(box, { attr: { transform: "scale(1.8)" } }, { attr: { transform: "scale(1)" }, duration: 0.5, ease: "back.out(2)" }, "<")
    .to(reticle, { attr: { transform: retAt(VERTEBRAE[at("L1")]) }, duration: 0.55 }, "+=0.35").call(say(hudTarget, "L1"), null, "<")
    .to(reticle, { attr: { transform: retAt(L2) }, duration: 0.55 }, "+=0.3").call(say(hudTarget, "L2"), null, "<")
    // lock
    .to(box, { attr: { transform: "scale(0.82)" }, duration: 0.18, ease: "power2.in" }, "+=0.15")
    .to(box, { attr: { transform: "scale(1)" }, duration: 0.5, ease: "elastic.out(1, 0.4)" })
    .call(() => verts[at("L2")].classList.add("is-locked"), null, "<")
    .to(verts[at("L2")].querySelector(".vert-label"), { opacity: 1, duration: 0.3 }, "<")
    .call(say(hudState, "LOCKED"), null, "<")
    .fromTo(trust, { v: 0.31 }, { v: 0.94, duration: 1.1, ease: "power2.out", onUpdate: showTrust, immediateRender: false }, "<")
    // correct: the curve straightens along the planned axis
    .call(say(hudState, "CORRECTING"), null, "+=0.5")
    .to(axis, { opacity: 0.9, duration: 0.4 }, "<")
    .to(verts, { attr: { transform: straight }, duration: 1.7, stagger: { each: 0.05, from: "center" } }, "<")
    .to(reticle, { attr: { transform: retAt(L2, true) }, duration: 1.7 }, "<")
    .call(say(hudState, "ALIGNED"))
    .to({}, { duration: 1.8 })
    // relax back to the start
    .call(say(hudState, "RESET"))
    .to(reticle, { opacity: 0, duration: 0.4 })
    .to([axis, verts[at("L2")].querySelector(".vert-label")], { opacity: 0, duration: 0.4 }, "<")
    .call(() => verts[at("L2")].classList.remove("is-locked"), null, "<")
    .to(verts, { attr: { transform: (i) => curve(VERTEBRAE[i]) }, duration: 1.5, stagger: { each: 0.04, from: "edges" } }, "<")
    .to(trust, { v: 0, duration: 0.6, onUpdate: showTrust }, "<")
    .set(reticle, { attr: { transform: retAt(VERTEBRAE[at("T12")]) } })
    .to({}, { duration: 0.4 });
  intro.call(() => loop.play(), null, 2.2);
  ctx.add(() => () => loop.kill());

  /* pointer: tilt the instrument in 3D, layers shift for depth */
  if (fine) {
    const wrap = $(".instrument") || art.firstElementChild;
    gsap.set(wrap, { transformPerspective: 900 });
    const rx = gsap.quickTo(wrap, "rotationX", { duration: 0.9, ease: "power3" });
    const ry = gsap.quickTo(wrap, "rotationY", { duration: 0.9, ease: "power3" });
    const bx = gsap.quickTo(".instrument .layer-back", "x", { duration: 1.1, ease: "power3" });
    const by = gsap.quickTo(".instrument .layer-back", "y", { duration: 1.1, ease: "power3" });
    const fx = gsap.quickTo(".instrument .layer-front", "x", { duration: 0.9, ease: "power3" });
    const fy = gsap.quickTo(".instrument .layer-front", "y", { duration: 0.9, ease: "power3" });
    const onMove = (e) => {
      const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
      ry(nx * 14); rx(ny * -10); bx(nx * -8); by(ny * -8); fx(nx * 6); fy(ny * 6);
    };
    addEventListener("pointermove", onMove);
    ctx.add(() => () => removeEventListener("pointermove", onMove));
  }

  /* scroll away: settle back and fade as the hero leaves */
  // Keyed to the instrument itself, so on phones (where it sits below the text) it stays visible until it scrolls past.
  // (Tweens the inner .instrument's svg, not `art`, so it never fights the intro's opacity/scale.)
  gsap.fromTo(art.querySelector("svg"), { yPercent: 0, scale: 1, opacity: 1 }, { yPercent: 10, scale: 0.94, opacity: 0.25, ease: "none", immediateRender: false, scrollTrigger: { trigger: art, start: "top top", end: "bottom top", scrub: true } });
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

    // Instrument: rings draw in, the curved spine assembles, then the robot loop
    // runs: scan -> hunt for the target -> lock on L2 -> straighten the curve -> relax.
    const art = document.querySelector('[data-hero="art"]');
    if (art) initInstrument(gsap, tl, art, fine, ctx);

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
