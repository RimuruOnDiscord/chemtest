/* =============================================================================
   chemtest — page transition ("sticker-sheet curtain")
   -----------------------------------------------------------------------------
   Old page:  yellow → pink → blue → ink sheets sweep in smoothly on a gentle
              diagonal while the chemtest wordmark lights up yellow and the
              destination pill pops in, then we navigate.
   New page:  an inline <head> script restores the covered state before first
              paint (html.pt-hold), the wordmark completes its fill, and the
              sheets peel away smoothly in reverse order (html.pt-out).
   Reduced motion: no interception — plain, instant navigation.
   ========================================================================== */
(() => {
  const html = document.documentElement;
  const KEY = "ct-pt";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const COVER_MS = 640; // sheets + wordmark sweep finish right as navigation fires
  const MIN_HOLD_MS = 180; // brief seamless finish on arrival before peeling away
  const OUT_MS = 780; // sheet .54s + 3 × .045s stagger + buffer

  const TOPICS = {
    ionic: "Ionic · Criss-Cross",
    polyatomic: "Polyatomic Ions",
    covalent: "Covalent & Hydrates",
    acids: "Acids & Classics",
  };
  const SECTIONS = {
    fallback: "Check Points",
    tryon: "Mirror Parser",
    test: "Reference Table",
    houses: "Formula Pit",
    free: "Rule Twins",
    demo: "Quick Demo",
  };

  const pagePath = (url) =>
    url.pathname.replace(/\/$/, "/index.html").replace(/\/(index|exam)$/, "/$1.html");
  const isExam = (url) => /\/exam\.html$/.test(pagePath(url));

  function labelsFor(url) {
    if (isExam(url)) {
      const t = TOPICS[url.searchParams.get("topic")];
      return { dir: "fwd", dest: `${t || "Mock Exam"} →` };
    }
    const sec = SECTIONS[url.hash.slice(1)];
    return { dir: "back", dest: `← ${sec || "Study Lab"}` };
  }

  function setLabels(d) {
    const dest = document.getElementById("pt-dest");
    if (dest) dest.textContent = d.dest;
  }

  /* ---------------------------------------------------------------- leave -- */
  let busy = false;

  function go(href) {
    const url = new URL(href, location.href);
    if (busy) return;
    if (reduceMotion.matches || !document.getElementById("pt")) {
      location.href = url.href;
      return;
    }
    busy = true;

    const d = labelsFor(url);
    setLabels(d);

    // Modal dialogs live in the top layer and would sit above the curtain.
    document.querySelectorAll("dialog[open]").forEach((dlg) => dlg.close());

    html.classList.remove("pt-hold", "pt-out");
    html.dataset.ptDir = d.dir;
    html.classList.add("pt-in");

    setTimeout(() => {
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ ...d, t: Date.now() }));
      } catch (_) {}
      location.href = url.href;
    }, COVER_MS);
  }
  window.ctGo = go;

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.("a[href]");
    if (!a || a.hasAttribute("download")) return;
    if (a.target && a.target !== "_self") return;

    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (!/\.html$|\/(index|exam)?$/.test(url.pathname)) return;
    // Same document (hash jumps, e.g. #demo) keep their native smooth scroll.
    if (pagePath(url) === pagePath(location) && url.search === location.search) return;

    e.preventDefault();
    go(url.href);
  });

  /* --------------------------------------------------------------- arrive -- */
  function reveal(startedAt) {
    const wait = Math.max(0, MIN_HOLD_MS - (performance.now() - startedAt));
    const fontsReady = document.fonts
      ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 380))])
      : Promise.resolve();

    fontsReady.then(() => {
      setTimeout(() => {
        requestAnimationFrame(() => {
          html.classList.add("pt-out");
          setTimeout(() => {
            html.classList.remove("pt-hold", "pt-out");
            delete html.dataset.ptDir;
          }, OUT_MS);
        });
      }, wait);
    });
  }

  if (html.classList.contains("pt-hold")) {
    reveal(window.__ctPT?.at ?? performance.now());
  }

  // Back/forward cache: the page we left is restored still covered — peel it open.
  addEventListener("pageshow", (e) => {
    if (!e.persisted || !html.classList.contains("pt-in")) return;
    busy = false;
    html.classList.remove("pt-in");
    html.dataset.ptDir = html.dataset.ptDir === "fwd" ? "back" : "fwd";
    html.classList.add("pt-hold");
    reveal(performance.now() - MIN_HOLD_MS);
  });
})();
