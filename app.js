import {
  QUESTIONS,
  CHECKPOINTS,
  MIRROR_CLASSES,
  ION_GRID_ITEMS,
  ROLODEX_CARDS
} from "./data.js";

// ============================================================================
// 1. ENVIRONMENT & DOM HELPERS (1:1 Chemtest / Fontsight Base)
// ============================================================================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v != null && v !== false) {
      if (k === "class") node.className = v;
      else if (k === "style") {
        if (typeof v === "string") node.style.cssText = v;
        else {
          for (const [sk, sv] of Object.entries(v)) {
            if (sk.startsWith("--")) node.style.setProperty(sk, sv);
            else node.style[sk] = sv;
          }
        }
      } else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    }
  }
  for (const c of children.flat()) {
    if (c != null && c !== false) node.append(c.nodeType ? c : String(c));
  }
  return node;
}

const toastEl = $("#toast");
function showToast(html, ms = 3000) {
  if (!toastEl) return;
  toastEl.innerHTML = html;
  toastEl.hidden = false;
  toastEl.classList.remove("in");
  void toastEl.offsetWidth;
  toastEl.classList.add("in");
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => { toastEl.hidden = true; }, ms);
}

// Base.js Optical Letter-Spacing Curve for Inter
const lsU = -0.0223, lsD = 0.185, lsF = -0.1745;
const calcInterTracking = (px) => lsU + lsD * Math.exp(lsF * px);
const trackedNodes = new WeakSet();
function hasDirectText(node) {
  for (const child of node.childNodes) {
    if (child.nodeType === 3 && child.nodeValue.trim()) return true;
  }
  return false;
}
function applyOpticalTracking(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let n = root; n; n = walker.nextNode()) {
    if (!hasDirectText(n)) continue;
    const cs = getComputedStyle(n);
    if (!/^"?Inter\b/.test(cs.fontFamily)) continue;
    let p = n.parentElement;
    while (p && !trackedNodes.has(p)) p = p.parentElement;
    const inherited = p && cs.letterSpacing === getComputedStyle(p).letterSpacing;
    if (cs.letterSpacing === "normal" || trackedNodes.has(n) || inherited) {
      n.style.letterSpacing = `${calcInterTracking(parseFloat(cs.fontSize)).toFixed(4)}em`;
      trackedNodes.add(n);
    }
  }
}
document.fonts?.ready.then(() => applyOpticalTracking(document.body));
applyOpticalTracking(document.body);

// ============================================================================
// 2. CUSTOM CURSOR & CLICK PING ANIMATION (1:1 #cur + .cur-ping)
// ============================================================================
const curEl = $("#cur");
const curSvg = $("#cur svg");
let ptrX = -1, ptrY = -1, prevPtrX = -1;
let curAngle = 0, curScale = 1, targetScale = 1, curRaf = 0, moveQueued = false;

function stepCursorSpring() {
  if (!curSvg) return;
  const deltaTilt = clamp((ptrX - prevPtrX) * 0.9, -22, 22);
  prevPtrX = ptrX;
  curAngle += (deltaTilt - curAngle) * 0.22;
  curScale += (targetScale - curScale) * 0.35;
  curSvg.style.transform = `rotate(${curAngle.toFixed(2)}deg) scale(${curScale.toFixed(3)})`;
  curRaf = Math.abs(curAngle) > 0.05 || Math.abs(targetScale - curScale) > 0.002
    ? requestAnimationFrame(stepCursorSpring)
    : 0;
  if (!curRaf) curSvg.style.transform = "";
}
const wakeCursorSpring = () => { curRaf ||= requestAnimationFrame(stepCursorSpring); };

if (finePointer) {
  document.documentElement.classList.add("cc");
}

// ============================================================================
// 3. ANIMATED NERD MASCOT (Eye Tracking & Mood Reactions)
// ============================================================================
const nerdSvg = $("#exam-nerd");
const nerdMouth = $("#nerd-mouth-path");
const MOUTH_PATHS = {
  happy: "M370 665 Q490 760 600 665",
  wow: "M435 675 Q490 755 545 675",
  wink: "M365 655 Q495 775 615 645",
  oops: "M390 715 Q490 645 590 715"
};
let nerdMoodTimer = 0;
function reactNerd(mood = "wink", duration = 1100) {
  if (!nerdSvg) return;
  nerdSvg.dataset.mood = mood;
  if (nerdMouth && MOUTH_PATHS[mood]) {
    nerdMouth.setAttribute("d", MOUTH_PATHS[mood]);
  }
  clearTimeout(nerdMoodTimer);
  nerdMoodTimer = setTimeout(() => {
    delete nerdSvg.dataset.mood;
    if (nerdMouth) nerdMouth.setAttribute("d", MOUTH_PATHS.happy);
  }, duration);
}
function updateNerdEyes(clientX, clientY) {
  if (!nerdSvg || reducedMotion) return;
  const r = nerdSvg.getBoundingClientRect();
  if (r.width === 0) return;
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const dx = clamp((clientX - cx) / 14, -22, 22);
  const dy = clamp((clientY - cy) / 14, -18, 18);
  nerdSvg.style.setProperty("--look-x", `${dx.toFixed(1)}px`);
  nerdSvg.style.setProperty("--look-y", `${dy.toFixed(1)}px`);
}

// ============================================================================
// 4. POINTER TRACKING & HERO #ANNO / #SHUFFLE CALLOUT LINES
// ============================================================================
const annoEl = $("#anno");
const annoLines = $("#anno-lines");
const annoBox = $("#anno-box");
const shuffleGlyphs = $$("#shuffle i");
const annoTags = $$(".anno-tag");
const FACE_INDEX = { fB: 0, fI: 2, fD: 4, fG: 7 };
const FACE_OFFSET = { fB: [0.36, -0.55], fI: [0.62, -0.2], fD: [0.88, 0.25], fG: [0.5, 0.7] };
const DEFAULT_FACE = "fD";
let activeFace = DEFAULT_FACE;
let heldGlyph = null;

function relBox(node) {
  let left = 0, top = 0;
  for (let cur = node; cur && cur !== annoEl; cur = cur.offsetParent) {
    left += cur.offsetLeft;
    top += cur.offsetTop;
  }
  return { left, top, width: node.offsetWidth, height: node.offsetHeight };
}

function highlightHeroFace(face) {
  if (!annoEl || !annoLines) return;
  activeFace = face;
  for (const t of annoTags) t.classList.toggle("on", t.dataset.face === face);
  for (const p of annoLines.querySelectorAll("path")) p.classList.toggle("on", p.dataset.face === face);
}

function placeHeroGlyphBox(glyph) {
  if (!annoBox) return;
  if (!glyph) {
    annoBox.hidden = true;
    return;
  }
  const r = relBox(glyph);
  annoBox.hidden = false;
  Object.assign(annoBox.style, {
    transform: `translate(${r.left - 8}px, ${r.top + r.height * 0.06}px)`,
    width: `${r.width + 16}px`,
    height: `${r.height * 0.98}px`
  });
}

function layoutHeroAnnotations() {
  if (!annoEl || !annoLines || innerWidth <= 820) return;
  const box = { width: annoEl.offsetWidth, height: annoEl.offsetHeight };
  const fs = parseFloat(getComputedStyle($("#shuffle")).fontSize);
  let paths = "";
  for (const tag of annoTags) {
    const face = tag.dataset.face;
    const glyph = shuffleGlyphs[FACE_INDEX[face]];
    if (!glyph) continue;
    const gRect = relBox(glyph);
    const gx = gRect.left + gRect.width / 2;
    const gy = gRect.top + gRect.height * 0.12;
    const [oy, ox] = FACE_OFFSET[face];
    const tw = tag.offsetWidth, th = tag.offsetHeight;
    const tx = Math.min(Math.max(gx + ox * fs - tw / 2, -40), box.width - tw + 40);
    const ty = gy - oy * fs - th;
    tag.style.transform = `translate(${tx}px, ${ty}px)`;
    const anchorX = Math.min(Math.max(gx, tx + 18), tx + tw - 18);
    paths += `<path d="M${anchorX.toFixed(1)} ${(ty + th).toFixed(1)} L ${gx.toFixed(1)} ${(gy - 8).toFixed(1)}" data-face="${face}"/>`;
  }
  annoLines.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
  annoLines.innerHTML = paths;
  annoEl.toggleAttribute("data-placed", true);
  highlightHeroFace(activeFace);
  placeHeroGlyphBox(activeFace === DEFAULT_FACE ? shuffleGlyphs[FACE_INDEX[DEFAULT_FACE]] : null);
}

if (annoEl) {
  addEventListener("resize", layoutHeroAnnotations);
  document.fonts?.ready.then(() => requestAnimationFrame(layoutHeroAnnotations));
  setTimeout(layoutHeroAnnotations, 350);
}

function handlePointerFrame() {
  moveQueued = false;
  const hit = document.elementFromPoint(ptrX, ptrY);

  // Hero glyph hover reaction
  if (annoEl) {
    const glyphHit = hit?.closest?.("#shuffle i") || null;
    if (glyphHit !== heldGlyph) {
      heldGlyph?.classList.remove("hold");
      heldGlyph = glyphHit;
      heldGlyph?.classList.add("hold");
      const face = heldGlyph ? [...heldGlyph.classList].find((c) => c in FACE_INDEX) : null;
      highlightHeroFace(face ?? DEFAULT_FACE);
      placeHeroGlyphBox(face ? null : shuffleGlyphs[FACE_INDEX[DEFAULT_FACE]]);
    }
  }

  if (finePointer && curEl) {
    curEl.dataset.s = hit?.closest("a,button,.key,.mc-opt,.qd-opt,.qd-tab,.topic-pill,.cp-tab,.to-tile,.chem-sym-btn,.q-nav-dot,.side-mini-btn")
      ? "link"
      : hit?.closest(".pit")
        ? "grab"
        : hit?.closest("#shuffle i,[contenteditable],input")
          ? "text"
          : "";
    curEl.classList.toggle("on-dark", !!hit?.closest(".hero,.fallback,.twins,.footer,.exam-top-bar,.rolo"));
    wakeCursorSpring();
  }
}

addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse") {
    ptrX = e.clientX;
    ptrY = e.clientY;
    if (finePointer && curEl) {
      curEl.hidden = false;
      curEl.style.transform = `translate3d(${ptrX}px, ${ptrY}px, 0)`;
    }
    updateNerdEyes(ptrX, ptrY);
    if (!moveQueued) {
      moveQueued = true;
      requestAnimationFrame(handlePointerFrame);
    }
  }
}, { passive: true });

document.documentElement.addEventListener("pointerleave", () => {
  if (curEl) curEl.hidden = true;
});

addEventListener("pointerdown", () => {
  targetScale = 0.8;
  wakeCursorSpring();
  if (curEl) {
    curEl.classList.remove("ping");
    void curEl.offsetWidth;
    curEl.classList.add("ping");
  }
});

addEventListener("pointerup", () => {
  targetScale = 1;
  wakeCursorSpring();
});

// ============================================================================
// 5. LANDING PAGE QUICK DEMO SHOWCASE (#site / #qd-grid + #ghost Cursor)
// ============================================================================
const QUICK_DEMO_SAMPLES = [
  {
    kicker: "SAMPLE N° 01 — BINARY IONIC · P. 141",
    prompt: "Ca₃P₂ — Name this salt.",
    sub: "Formed by crossing calcium (Ca²⁺) and phosphide (P³⁻) ions on the kick wheel of charge balance.",
    options: ["calcium phosphide", "tricalcium diphosphide", "calcium phosphate", "calcium(II) phosphide"],
    correct: 0,
    ruleTag: "Cation + -ide",
    explain: "Group 2 metals have a fixed +2 charge—never use Greek prefixes or Roman numerals.",
    sideKicker: "On the formula sheet",
    sideQuote: "“Cation first, then anion root + -ide.”",
    sideFormula: "Ca²⁺ + P³⁻ → Ca₃P₂ ✷",
    sideSign: "Warmly, Chemtest."
  },
  {
    kicker: "SAMPLE N° 02 — STOCK & CLASSICAL · P. 142",
    prompt: "PbO₂ — Reduced from Pb₂O₄.",
    sub: "Lead(IV) (Pb⁴⁺) and oxide (O²⁻) criss-cross to Pb₂O₄, then simplify by dividing subscripts by 2.",
    options: ["lead(II) oxide", "lead(IV) oxide", "lead dioxide", "plumbous oxide"],
    correct: 1,
    ruleTag: "Reduce Ratio",
    explain: "Each O²⁻ is −2 (total −4), so lead is Pb⁴⁺: lead(IV) oxide (or plumbic oxide).",
    sideKicker: "Criss-cross & reduce",
    sideQuote: "“Always reduce ionic subscripts to simplest ratio.”",
    sideFormula: "Pb⁴⁺ + 2 O²⁻ → PbO₂ ✷",
    sideSign: "Plumbic, not plumbous."
  },
  {
    kicker: "SAMPLE N° 03 — TERNARY POLYATOMIC · P. 145",
    prompt: "Magnesium phosphate.",
    sub: "Combine Mg²⁺ and PO₄³⁻. Enclose the polyatomic ion in parentheses whenever 2 or more units are needed.",
    options: ["MgPO₄", "Mg₃(PO₄)₂", "Mg₂(PO₄)₃", "Mg₃PO₈"],
    correct: 1,
    ruleTag: "Parentheses Rule",
    explain: "Criss-crossing Mg²⁺ and PO₄³⁻ gives 3 Mg²⁺ and 2 PO₄³⁻ → Mg₃(PO₄)₂.",
    sideKicker: "Polyatomic oxyanions",
    sideQuote: "“Parentheses only when 2+ polyatomic units.”",
    sideFormula: "3 Mg²⁺ + 2 PO₄³⁻ ✷",
    sideSign: "Keep -ate unchanged."
  },
  {
    kicker: "SAMPLE N° 04 — BINARY COVALENT · P. 148",
    prompt: "N₂O₄ — Two nonmetals.",
    sub: "Covalent molecules never reduce subscripts. Use Greek prefixes and drop the final ‘a’ before oxide.",
    options: ["nitrogen tetroxide", "dinitrogen tetroxide", "dinitrogen tetraoxide", "nitrogen(IV) oxide"],
    correct: 1,
    ruleTag: "Greek Prefixes",
    explain: "2 N = dinitrogen, 4 O = tetroxide (vowel ‘a’ dropped before oxide) → dinitrogen tetroxide.",
    sideKicker: "Oxides of nitrogen",
    sideQuote: "“Drop the ‘a’ in tetra- before oxide.”",
    sideFormula: "di- (2) + tetr- (4) ✷",
    sideSign: "Never reduce covalent."
  },
  {
    kicker: "SAMPLE N° 05 — OXYACID RULE · P. 153",
    prompt: "HNO₂(aq) — From nitrite.",
    sub: "Oxyacids never use the prefix hydro-. Convert -ate anions to -ic acid, and -ite anions to -ous acid.",
    options: ["nitric acid", "nitrous acid", "hydronitrous acid", "hydronitric acid"],
    correct: 1,
    ruleTag: "-ite → -ous acid",
    explain: "NO₂⁻ is nitrite (-ite → -ous acid), so HNO₂ is nitrous acid.",
    sideKicker: "Acids & oxyanions",
    sideQuote: "“-ite becomes -ous acid; -ate becomes -ic acid.”",
    sideFormula: "H⁺ + NO₂⁻ → HNO₂ ✷",
    sideSign: "No hydro- on oxyacids."
  }
];

function initQuickDemo() {
  const qdGrid = $("#qd-grid");
  const qdTabs = $("#qd-tabs");
  const siteEl = $("#site");
  const ghostEl = $("#ghost");
  if (!qdGrid || !qdTabs) return;

  let qdIdx = 0;
  let qdPicked = null;

  function renderQuickSample() {
    const s = QUICK_DEMO_SAMPLES[qdIdx];
    $("#qd-kicker").textContent = s.kicker;
    $("#qd-prompt").textContent = s.prompt;
    $("#qd-sub").textContent = s.sub;
    $("#qd-side-kicker").textContent = s.sideKicker;
    $("#qd-side-quote").textContent = s.sideQuote;
    $("#qd-side-formula").textContent = s.sideFormula;
    $("#qd-side-sign").textContent = s.sideSign;

    for (const tab of $$(".qd-tab", qdTabs)) {
      tab.setAttribute("aria-selected", String(Number(tab.dataset.qd) === qdIdx));
    }

    const keys = ["A", "B", "C", "D"];
    qdGrid.replaceChildren(
      ...s.options.map((opt, i) => {
        let cls = "qd-opt";
        if (qdPicked !== null) {
          if (i === s.correct) cls += " correct";
          else if (i === qdPicked) cls += " wrong";
        }
        return el("button", {
          type: "button",
          class: cls,
          onclick: () => {
            qdPicked = i;
            const ok = i === s.correct;
            reactNerd(ok ? "wink" : "oops", 1100);
            renderQuickSample();
          }
        },
          el("span", { class: "qd-key" }, keys[i]),
          el("span", null, opt)
        );
      })
    );

    const fb = $("#qd-feedback");
    if (qdPicked !== null) {
      const ok = qdPicked === s.correct;
      fb.hidden = false;
      fb.classList.toggle("err", !ok);
      $("#qd-fb-text").innerHTML = `${ok ? "<b>✓ Correct!</b>" : `<b>✗ Answer: ${s.options[s.correct]}.</b>`} ${s.explain}`;
      $("#qd-fb-tag").textContent = s.ruleTag;
    } else {
      fb.hidden = true;
    }
  }

  for (const tab of $$(".qd-tab", qdTabs)) {
    tab.addEventListener("click", () => {
      qdIdx = Number(tab.dataset.qd);
      qdPicked = null;
      renderQuickSample();
    });
  }

  $("#qd-next-btn")?.addEventListener("click", () => {
    qdIdx = (qdIdx + 1) % QUICK_DEMO_SAMPLES.length;
    qdPicked = null;
    renderQuickSample();
  });

  renderQuickSample();

  // Animated Ghost Cursor inside .site when user isn't hovering it
  if (siteEl && ghostEl && !reducedMotion) {
    let userInSite = false;
    let siteVisible = false;
    let ghostTimer = 0;

    siteEl.addEventListener("pointerenter", () => {
      userInSite = true;
      ghostEl.classList.remove("show");
      clearTimeout(ghostTimer);
    });
    siteEl.addEventListener("pointerleave", () => {
      userInSite = false;
      scheduleGhostStep(1400);
    });

    new IntersectionObserver(([entry]) => {
      siteVisible = entry.isIntersecting;
      if (siteVisible && !userInSite) scheduleGhostStep(900);
      else {
        ghostEl.classList.remove("show");
        clearTimeout(ghostTimer);
      }
    }, { threshold: 0.35 }).observe(siteEl);

    function scheduleGhostStep(delay = 2200) {
      clearTimeout(ghostTimer);
      if (!siteVisible || userInSite) return;
      ghostTimer = setTimeout(() => {
        if (!siteVisible || userInSite) return;
        const s = QUICK_DEMO_SAMPLES[qdIdx];
        const targetBtn = qdPicked === null
          ? qdGrid.children[s.correct]
          : $("#qd-next-btn");
        if (!targetBtn) return;
        const sr = siteEl.getBoundingClientRect();
        const tr = targetBtn.getBoundingClientRect();
        const x = tr.left - sr.left + tr.width * 0.55;
        const y = tr.top - sr.top + tr.height * 0.55;
        ghostEl.classList.add("show");
        ghostEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;

        ghostTimer = setTimeout(() => {
          if (!siteVisible || userInSite) return;
          ghostEl.classList.add("click");
          ghostEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(0.84)`;
          setTimeout(() => {
            ghostEl.classList.remove("click");
            ghostEl.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
            if (!siteVisible || userInSite) return;
            if (qdPicked === null) {
              qdPicked = s.correct;
              reactNerd("wink", 900);
              renderQuickSample();
              scheduleGhostStep(2600);
            } else {
              qdIdx = (qdIdx + 1) % QUICK_DEMO_SAMPLES.length;
              qdPicked = null;
              renderQuickSample();
              scheduleGhostStep(1800);
            }
          }, 150);
        }, 980);
      }, delay);
    }
  }
}
initQuickDemo();

// ============================================================================
// 6. FULL 40-QUESTION MOCK EXAM ENGINE (exam.html)
// ============================================================================
const SUBSCRIPT_MAP = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };
const NORMAL_DIGIT_MAP = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };

function formatChemFormulaPreview(raw) {
  if (!raw.trim()) return "—";
  return raw
    .replace(/\*/g, "·")
    .replace(/([A-Za-z)\]])(\d+)/g, (_, p1, digits) => p1 + [...digits].map((d) => SUBSCRIPT_MAP[d] || d).join(""));
}

function normalizeAnswer(str) {
  return (str || "")
    .trim()
    .toLowerCase()
    .replace(/[₀-₉]/g, (c) => NORMAL_DIGIT_MAP[c] || c)
    .replace(/[·•*]/g, ".")
    .replace(/\s+/g, " ");
}

// Interactive Playful Chemistry Blocks per Question (Tap any block to inspect its rule)
const QUESTION_PLAY_BLOCKS = {
  1: { conn: "⇄", tiles: [["Ca²⁺", "Group 2 cation", "blue", "<b>Ca²⁺</b> is a fixed-charge Group 2 metal → keep the element name <b>calcium</b> (never use Greek prefixes or Roman numerals)."], ["P³⁻", "root + -ide", "pink", "<b>P³⁻</b> comes from phosphorus → take root <b>phosph-</b> + <b>-ide</b> = <b>phosphide</b>."]] },
  2: { conn: "⇄", tiles: [["Ca²⁺", "+2 cation", "blue", "Calcium is in Group 2 → <b>Ca²⁺</b>."], ["F⁻", "−1 anion", "pink", "Fluoride is in Group 17 → <b>F⁻</b>. Criss-crossing +2 and −1 gives <b>1 Ca</b> and <b>2 F</b>."]] },
  3: { conn: "⇄", tiles: [["Al³⁺", "+3 cation", "blue", "Aluminum forms a fixed <b>Al³⁺</b> cation."], ["Cl⁻", "−1 anion", "pink", "Chloride is <b>Cl⁻</b>. Criss-crossing +3 and −1 requires <b>3 Cl⁻</b> ions per Al³⁺."]] },
  4: { conn: "→", tiles: [["Cr²⁺ + O²⁻", "criss-cross", "blue", "Chromium(II) is <b>Cr²⁺</b> and oxide is <b>O²⁻</b> → crossing gives Cr₂O₂."], ["÷ 2", "reduce ratio", "yellow", "Always divide ionic subscripts by their greatest common divisor: Cr₂O₂ ÷ 2 → <b>CrO</b>."]] },
  5: { conn: "→", tiles: [["Pb⁴⁺ + O²⁻", "cross charges", "blue", "Crossing +4 and −2 initially gives <b>Pb₂O₄</b>."], ["PbO₂", "lowest ratio", "yellow", "Dividing both subscripts by 2 gives <b>PbO₂</b>, named <b>lead(IV) oxide</b>."]] },
  6: { conn: "+", tiles: [["2 Ag⁺", "fixed +1 metal", "blue", "Silver always forms <b>Ag⁺</b> in Grade 11 nomenclature (no Roman numeral needed)."], ["O²⁻", "oxide (−2)", "pink", "Oxygen forms <b>O²⁻</b> (oxide) → <b>silver oxide</b>."]] },
  7: { conn: "+", tiles: [["Hg₂²⁺", "mercury(I) dimer", "blue", "Two Hg⁺ atoms bond together into the diatomic ion <b>Hg₂²⁺</b> (+1 per Hg atom)."], ["2 Cl⁻", "2 × (−1) = −2", "pink", "Two chloride ions balance the +2 dimer → <b>mercury(I) chloride</b>."]] },
  8: { conn: "⇄", tiles: [["Fe³⁺", "higher charge", "yellow", "Three Cl⁻ ions (−3) mean iron is <b>Fe³⁺</b> (higher state = <b>iron(III)</b> or <b>ferric</b>)."], ["3 Cl⁻", "chloride", "blue", "Fe²⁺ is ferrous (-ous); Fe³⁺ is <b>ferric (-ic)</b>."]] },
  9: { conn: "vs.", tiles: [["Cu⁺", "lower → -ous", "blue", "Lower oxidation state (+1) takes <b>-ous</b> → <b>cuprous</b>."], ["Cu²⁺", "higher → -ic", "pink", "Higher oxidation state (+2) takes <b>-ic</b> → <b>cupric</b>."]] },
  10: { conn: "+", tiles: [["K⁺", "potassium", "blue", "Group 1 metal cation <b>K⁺</b>."], ["I⁻", "iodide (2 elements)", "pink", "2 elements total (metal + nonmetal) = <b>binary inorganic ionic</b>."]] },
  11: { conn: "⇄", tiles: [["Ba²⁺", "+2 cation", "blue", "Barium is Group 2 → <b>Ba²⁺</b>."], ["(OH)₂", "2 × OH⁻ units", "pink", "Whenever <b>2 or more</b> polyatomic ions are needed, enclose the unit in parentheses: <b>Ba(OH)₂</b>."]] },
  12: { conn: "+", tiles: [["2 K⁺", "2 × (+1) = +2", "blue", "Two K⁺ cations provide +2 charge."], ["Cr₂O₇²⁻", "1 dichromate unit", "yellow", "Dichromate is <b>Cr₂O₇²⁻</b>. Only 1 unit is needed, so no parentheses!" ]] },
  13: { conn: "⇄", tiles: [["3 Mg²⁺", "3 × (+2) = +6", "blue", "Magnesium is <b>Mg²⁺</b>."], ["2 PO₄³⁻", "2 × (−3) = −6", "pink", "Phosphate is <b>PO₄³⁻</b>. Crossing gives <b>Mg₃(PO₄)₂</b>."]] },
  14: { conn: "+", tiles: [["K⁺", "potassium", "blue", "Group 1 cation <b>K⁺</b>."], ["MnO₄⁻", "permanganate", "pink", "The −1 oxyanion <b>MnO₄⁻</b> is <b>permanganate</b>."]] },
  15: { conn: "+", tiles: [["3 NH₄⁺", "ammonium (+1)", "blue", "<b>NH₄⁺</b> is the ammonium cation (never use Greek prefixes on polyatomic ions!)."], ["PO₄³⁻", "phosphate (−3)", "pink", "<b>PO₄³⁻</b> is phosphate → <b>ammonium phosphate</b>."]] },
  16: { conn: "⇄", tiles: [["Fe³⁺", "deduced +3", "yellow", "Because 1 Fe balances 1 PO₄³⁻ (−3), iron must carry a <b>+3</b> charge → <b>iron(III)</b>."], ["PO₄³⁻", "phosphate (−3)", "pink", "Phosphate always carries a <b>−3</b> charge."]] },
  17: { conn: "→", tiles: [["ClO⁻", "fewest O (hypo-)", "blue", "1 oxygen (fewest) = <b>hypochlorite</b>."], ["ClO₄⁻", "most O (per-)", "pink", "4 oxygens (most) = <b>perchlorate</b>."]] },
  18: { conn: "→", tiles: [["CO₃²⁻ + H⁺", "−2 + (+1)", "blue", "Adding one H⁺ reduces the negative charge by 1."], ["HCO₃⁻", "charge = −1", "go", "Result is <b>HCO₃⁻</b>, named <b>hydrogen carbonate</b> (bicarbonate)."]] },
  19: { conn: "·", tiles: [["OH⁻", "hydroxide", "blue", "Polyatomic exception #1 ending in <b>-ide</b>."], ["CN⁻", "cyanide", "yellow", "Polyatomic exception #2 ending in <b>-ide</b>."], ["O₂²⁻", "peroxide", "pink", "Polyatomic exception #3 ending in <b>-ide</b>."]] },
  20: { conn: "vs.", tiles: [["SO₃²⁻", "3 O → -ite", "blue", "Fewer oxygens (3 O) = <b>sulfite</b>."], ["SO₄²⁻", "4 O → -ate", "pink", "More oxygens (4 O) = <b>sulfate</b>."]] },
  21: { conn: "+", tiles: [["P₂", "2 = di-", "blue", "2 phosphorus atoms → <b>diphosphorus</b>."], ["O₅", "5 = pent(a)-", "pink", "Drop the final 'a' of penta- before oxide → <b>pentoxide</b>."]] },
  22: { conn: "+", tiles: [["C₁", "no mono- on 1st", "yellow", "Never put <b>mono-</b> on the first element in a binary covalent compound!"], ["O₂", "2 = dioxide", "blue", "2 oxygens on the second element → <b>dioxide</b>."]] },
  23: { conn: "·", tiles: [["MgSO₄", "ionic salt", "blue", "Mg²⁺ + SO₄²⁻ is named <b>magnesium sulfate</b>."], ["7 H₂O", "7 = hepta-", "go", "7 trapped water molecules = <b>heptahydrate</b>."]] },
  24: { conn: "+", tiles: [["S", "no prefix = 1", "blue", "No prefix on the first element means <b>1 S</b> atom."], ["O₃", "tri- = 3", "pink", "<b>tri-</b> on oxide means <b>3 O</b> atoms (neutral molecule, no charge!)."]] },
  25: { conn: "+", tiles: [["di- (N₂)", "2 nitrogen", "blue", "Prefix <b>di-</b> = 2 N atoms."], ["mon- (O₁)", "1 oxygen", "pink", "Prefix <b>mono-</b> on the second element = 1 O atom → <b>N₂O</b>."]] },
  26: { conn: "·", tiles: [["CuSO₄", "Cu²⁺ + SO₄²⁻", "blue", "Copper(II) (+2) balances sulfate (−2) in a 1:1 ratio → <b>CuSO₄</b>."], ["5 H₂O", "penta- = 5", "go", "Attached with a centered dot: <b>·5H₂O</b>."]] },
  27: { conn: "+", tiles: [["N₂", "di- = 2", "blue", "Never reduce covalent subscripts! 2 N = <b>dinitrogen</b>."], ["O₄", "tetr(a)- = 4", "pink", "Drop the 'a' of tetra- before oxide → <b>tetroxide</b>."]] },
  28: { conn: "→", tiles: [["Less EN 1st", "element order", "yellow", "Write the <b>less electronegative</b> nonmetal first."], ["H₂O · NH₃", "common names", "blue", "H₂O is always <b>water</b> and NH₃ is always <b>ammonia</b>."]] },
  29: { conn: "—heat→", tiles: [["CuSO₄·5H₂O", "blue hydrate", "blue", "Contains 5 trapped water molecules per formula unit."], ["CuSO₄", "white anhydrous", "yellow", "Water-free form is called <b>anhydrous copper(II) sulfate</b>."]] },
  30: { conn: "→", tiles: [["6 · 7 · 8", "hexa · hepta · octa", "blue", "6 = <b>hexa-</b>, 7 = <b>hepta-</b>, 8 = <b>octa-</b>."], ["9 · 10", "nona · deca", "pink", "9 = <b>nona-</b>, 10 = <b>deca-</b>."]] },
  31: { conn: "→", tiles: [["HI(aq)", "no oxygen", "blue", "Aqueous binary acid (H + I, no oxygen)."], ["hydro-...-ic", "binary acid rule", "go", "<code>hydro-</code> + <code>iod</code> + <code>-ic acid</code> → <b>hydroiodic acid</b>."]] },
  32: { conn: "→", tiles: [["NO₂⁻", "nitrite (-ite)", "blue", "HNO₂ contains the oxyanion <b>NO₂⁻ (nitrite)</b>."], ["-ous acid", "no hydro-!", "pink", "Oxyacids never use hydro-: <code>-ite</code> becomes <b>-ous acid</b> → <b>nitrous acid</b>."]] },
  33: { conn: "→", tiles: [["SO₄²⁻", "sulfate (-ate)", "blue", "H₂SO₄ is built from the oxyanion <b>SO₄²⁻ (sulfate)</b>."], ["-ic acid", "no hydro-!", "yellow", "Replace <code>-ate</code> with <b>-ic acid</b> on sulfur- → <b>sulfuric acid</b>."]] },
  34: { conn: "+", tiles: [["hydro- (H⁺)", "binary acid", "blue", "Prefix <code>hydro-</code> means a binary acid with no oxygen!"], ["Br⁻", "bromide (−1)", "pink", "One H⁺ balances one Br⁻ → <b>HBr</b>."]] },
  35: { conn: "+", tiles: [["H⁺", "+1 proton", "blue", "No <code>hydro-</code> + <code>-ic acid</code> means an oxyacid from an <b>-ate</b> ion."], ["NO₃⁻", "nitrate (−1)", "yellow", "Nitrate is <b>NO₃⁻</b> → 1 H⁺ + 1 NO₃⁻ = <b>HNO₃</b>."]] },
  36: { conn: "+", tiles: [["2 H⁺", "2 × (+1) = +2", "blue", "Two H⁺ ions are needed to balance a −2 oxyanion."], ["CO₃²⁻", "carbonate (−2)", "pink", "Carbonate is <b>CO₃²⁻</b> → <b>H₂CO₃</b>."]] },
  37: { conn: "vs.", tiles: [["HCl(g) vs (aq)", "state matters", "blue", "Gas = <b>hydrogen chloride</b>; aqueous = <b>hydrochloric acid</b>."], ["HCN(aq)", "CN⁻ ends in -ide", "yellow", "Because cyanide ends in <b>-ide</b>, HCN(aq) takes <code>hydro-</code> → <b>hydrocyanic acid</b>."]] },
  38: { conn: "vs.", tiles: [["IO₃⁻ → HIO₃", "-ate → -ic", "blue", "Iodate (IO₃⁻) → <b>iodic acid</b>."], ["IO₂⁻ → HIO₂", "-ite → -ous", "pink", "Iodite (IO₂⁻) → <b>iodous acid</b>."]] },
  39: { conn: "→", tiles: [["2 NaN₃(s)", "sodium azide", "yellow", "Packed inside car airbag igniters."], ["3 N₂(g)", "instant N₂ gas", "go", "Rapidly decomposes into harmless <b>nitrogen gas (N₂)</b> on impact."]] },
  40: { conn: "·", tiles: [["D₂O", "Gilbert N. Lewis", "blue", "Gilbert Lewis isolated pure <b>heavy water (D₂O)</b>."], ["S²⁻(aq)", "sulfide mystery", "pink", "Free <b>S²⁻</b> ions do not measurably exist in water!"]] }
};

const SUP_CHAR_MAP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "−" };

function formatChemHtml(str) {
  return String(str || "")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, (m) => `<sup>${[...m].map((c) => SUP_CHAR_MAP[c] || c).join("")}</sup>`)
    .replace(/[₀₁₂₃₄₅₆₇₈₉]+/g, (m) => `<sub>${[...m].map((c) => NORMAL_DIGIT_MAP[c] || c).join("")}</sub>`);
}

function buildQuestionTokens(q) {
  const ans = q.options[q.correctIndex];
  const isFormula = /^[A-Z(]/.test(ans) && !ans.includes(" ") && ans.length <= 16;
  if (isFormula) {
    const rawPieces = ans.match(/[A-Z][a-z]?|[₀-₉0-9]+|[()·]/g) || [ans];
    const pieces = rawPieces.map((p) => (/^[₀-₉]+$/.test(p) ? [...p].map((c) => NORMAL_DIGIT_MAP[c] || c).join("") : p));
    const distractors = ["2", "3", "4", "(", ")", "O", "H₂O", "(II)"];
    return [...new Set([...pieces, ...distractors])].slice(0, 9);
  }
  const words = ans.split(/(\s+|\(|\)|-)/).map((w) => w.trim()).filter(Boolean);
  const distractors = [];
  for (const opt of q.options) {
    for (const w of opt.split(/\s+/)) {
      if (w && !words.includes(w) && distractors.length < 4) distractors.push(w);
    }
  }
  return [...new Set([...words, ...distractors])].slice(0, 8);
}

function initFullExam() {
  const mcArea = $("#mc-area");
  if (!mcArea) return; // Only runs on exam.html

  let activeDeck = [...QUESTIONS];
  let currentIdx = 0;
  let answerMode = "mc"; // "mc" | "write"
  let selectedOptionIndex = null;
  const userState = new Map(); // id -> { answered, correct, userChoice }
  let currentStreak = 0;
  let bestStreak = 0;

  // Timer state
  let timerRunning = false;
  let timerSeconds = 15 * 60;
  let timerElapsed = 0;
  let timerInterval = 0;

  function updateTimerUI() {
    const pill = $("#timer-toggle-btn");
    const readout = $("#timer-readout");
    if (!readout) return;
    const m = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
    const s = String(timerSeconds % 60).padStart(2, "0");
    readout.textContent = `${m}:${s}`;
    pill?.classList.toggle("timer-active", timerRunning);
  }

  $("#timer-toggle-btn")?.addEventListener("click", () => {
    timerRunning = !timerRunning;
    clearInterval(timerInterval);
    if (timerRunning) {
      timerInterval = setInterval(() => {
        if (timerSeconds > 0) {
          timerSeconds--;
          timerElapsed++;
          updateTimerUI();
        } else {
          timerRunning = false;
          clearInterval(timerInterval);
          updateTimerUI();
          openScoreReport();
        }
      }, 1000);
    }
    updateTimerUI();
  });

  function getQuestionState(id) {
    if (!userState.has(id)) {
      userState.set(id, { answered: false, correct: false, userChoice: null });
    }
    return userState.get(id);
  }

  // Question Map Drawer Toggle
  const mapBtn = $("#btn-toggle-map");
  const mapDrawer = $("#exam-map-drawer");
  function setMapDrawerOpen(open) {
    if (!mapBtn || !mapDrawer) return;
    mapBtn.setAttribute("aria-expanded", String(open));
    mapDrawer.hidden = !open;
  }
  mapBtn?.addEventListener("click", () => {
    setMapDrawerOpen(mapDrawer.hidden);
  });

  function renderNavGrid() {
    const segWrap = $("#hud-segments");
    if (segWrap) {
      segWrap.replaceChildren(
        ...activeDeck.map((q, idx) => {
          const st = getQuestionState(q.id);
          const cls = [
            "hud-seg",
            idx === currentIdx ? "current" : "",
            st.answered ? (st.correct ? "done-ok" : "done-err") : ""
          ].filter(Boolean).join(" ");
          return el("button", {
            type: "button",
            class: cls,
            title: `Question ${idx + 1}`,
            onclick: () => {
              currentIdx = idx;
              renderQuestion(true);
            }
          });
        })
      );
    }

    const grid = $("#q-nav-grid");
    if (!grid) return;
    grid.replaceChildren(
      ...activeDeck.map((q, idx) => {
        const st = getQuestionState(q.id);
        const cls = [
          "q-nav-dot",
          idx === currentIdx ? "current" : "",
          st.answered ? (st.correct ? "done-ok" : "done-err") : ""
        ].filter(Boolean).join(" ");
        return el("button", {
          type: "button",
          class: cls,
          title: `Question ${idx + 1}: ${q.catLabel}`,
          onclick: () => {
            currentIdx = idx;
            setMapDrawerOpen(false);
            renderQuestion(true);
          }
        }, String(idx + 1));
      })
    );
  }

  function updateScoreboard(pulseStreak = false) {
    let answeredCount = 0;
    let correctCount = 0;
    for (const q of activeDeck) {
      const st = getQuestionState(q.id);
      if (st.answered) {
        answeredCount++;
        if (st.correct) correctCount++;
      }
    }
    const acc = answeredCount ? Math.round((correctCount / answeredCount) * 100) : 100;
    const qCounter = $("#hud-q-counter");
    if (qCounter) {
      qCounter.textContent = `${String(currentIdx + 1).padStart(2, "0")} / ${String(activeDeck.length).padStart(2, "0")}`;
    }
    $("#side-score-big").textContent = `${correctCount} / ${activeDeck.length}`;
    $("#stat-accuracy").textContent = `${acc}%`;
    $("#stat-streak").textContent = String(currentStreak);
    $("#stat-answered").textContent = `${answeredCount}/${activeDeck.length}`;

    const streakChip = $("#hud-streak-chip");
    if (streakChip) {
      streakChip.classList.toggle("hot", currentStreak > 0);
      if (pulseStreak && currentStreak > 0 && !reducedMotion) {
        streakChip.classList.remove("pulse");
        void streakChip.offsetWidth;
        streakChip.classList.add("pulse");
      }
    }
    renderNavGrid();
  }

  function renderPlayfulTiles(q) {
    const stage = $("#lab-tiles-stage");
    const banner = $("#lab-reveal-banner");
    if (!stage || !banner) return;
    banner.hidden = true;
    const model = QUESTION_PLAY_BLOCKS[q.id] || {
      conn: "→",
      tiles: [[q.catLabel, q.ruleTag, "yellow", q.context]]
    };

    const nodes = [];
    model.tiles.forEach(([sym, lbl, tone, detailHtml], idx) => {
      if (idx > 0) {
        nodes.push(el("span", { class: "lab-conn", "aria-hidden": "true" }, model.conn));
      }
      const tile = el(
        "button",
        {
          type: "button",
          class: "lab-tile",
          "data-tone": tone || "yellow",
          onclick: () => {
            const already = tile.classList.contains("inspected") && !banner.hidden;
            for (const t of $$(".lab-tile", stage)) t.classList.remove("inspected");
            if (already) {
              banner.hidden = true;
            } else {
              tile.classList.add("inspected");
              banner.innerHTML = formatChemHtml(detailHtml);
              banner.hidden = false;
            }
          }
        },
        el("span", { class: "lab-tile-sym", html: formatChemHtml(sym) }),
        el("span", { class: "lab-tile-lbl" }, lbl)
      );
      nodes.push(tile);
    });
    stage.replaceChildren(...nodes);
  }

  function renderTokenBank(q, disabled) {
    const bank = $("#token-bank");
    if (!bank) return;
    const tokens = buildQuestionTokens(q);
    const isFormula = /^[A-Z(]/.test(q.options[q.correctIndex]) && !q.options[q.correctIndex].includes(" ");
    bank.replaceChildren(
      ...tokens.map((tok) =>
        el(
          "button",
          {
            type: "button",
            class: "token-chip",
            disabled,
            html: formatChemHtml(tok),
            onclick: () => {
              const inp = $("#write-input");
              if (!inp || inp.disabled) return;
              const cur = inp.value;
              const sep = !isFormula && cur && !cur.endsWith(" ") && !cur.endsWith("(") && !cur.endsWith("-") && !tok.startsWith("(") && !tok.startsWith("-") ? " " : "";
              inp.value = cur + sep + tok;
              inp.dispatchEvent(new Event("input"));
              inp.focus();
            }
          }
        )
      )
    );
  }

  function showExplanation(kind, statusText, ruleTag, bodyHtml) {
    const explainBox = $("#q-explain");
    const head = $("#q-explain-head");
    explainBox.hidden = false;
    head.className = `q-explain-head ${kind}`;
    $("#q-explain-status").textContent = statusText;
    $("#q-explain-rule-tag").textContent = ruleTag;
    $("#q-explain-body").innerHTML = formatChemHtml(bodyHtml);
  }

  function updateActionBtnState(st) {
    const btn = $("#btn-submit-next");
    if (!btn) return;
    btn.classList.remove("ready-pulse", "continue-mode");
    if (st.answered) {
      btn.textContent = currentIdx < activeDeck.length - 1 ? "Continue →" : "Finish & Grade ↗";
      btn.classList.add("continue-mode");
    } else {
      btn.textContent = "Check Answer →";
      const hasInput = answerMode === "mc"
        ? selectedOptionIndex != null
        : Boolean($("#write-input")?.value.trim());
      if (hasInput) btn.classList.add("ready-pulse");
    }
  }

  const TOPIC_DISPLAY_NAMES = {
    ionic: "Binary Ionic",
    polyatomic: "Polyatomic Ions",
    covalent: "Covalent & Hydrates",
    acids: "Acids & Oxyacids"
  };

  function renderQuestion(animate = false) {
    const q = activeDeck[currentIdx];
    if (!q) return;
    const st = getQuestionState(q.id);
    selectedOptionIndex = st.answered && typeof st.userChoice === "number" ? st.userChoice : null;

    if (animate && !reducedMotion) {
      const body = $("#ec-body");
      if (body) {
        body.classList.remove("q-anim");
        void body.offsetWidth;
        body.classList.add("q-anim");
      }
    }

    $("#q-kicker").textContent = `Question ${String(currentIdx + 1).padStart(2, "0")} / ${String(activeDeck.length).padStart(2, "0")}`;
    const catTag = $("#q-cat-tag");
    const rawCat = q.catLabel.split("·")[0].trim();
    catTag.textContent = /^check\s*point/i.test(rawCat) ? (TOPIC_DISPLAY_NAMES[q.topic] || rawCat) : rawCat;
    catTag.dataset.cat = q.topic;

    const promptEl = $("#q-prompt");
    promptEl.innerHTML = q.promptHtml;
    promptEl.classList.toggle("serif-mode", !!q.serifPrompt);

    $("#q-sub").innerHTML = formatChemHtml(q.sub);

    // Render Playful Interactive Chemistry Tiles
    renderPlayfulTiles(q);

    // Render Multiple Choice options
    const writeArea = $("#write-area");
    mcArea.hidden = answerMode !== "mc";
    writeArea.hidden = answerMode !== "write";

    const keys = ["A", "B", "C", "D"];
    mcArea.replaceChildren(
      ...q.options.map((optText, i) => {
        let stateCls = "";
        if (st.answered) {
          if (i === q.correctIndex) stateCls = "correct";
          else if (i === st.userChoice) stateCls = "wrong";
        } else if (i === selectedOptionIndex) {
          stateCls = "selected";
        }
        return el("button", {
          type: "button",
          class: `mc-opt ${stateCls}`.trim(),
          disabled: st.answered,
          onclick: () => {
            if (st.answered) return;
            selectedOptionIndex = i;
            submitCurrentAnswer();
          }
        },
          el("span", { class: "mc-key" }, keys[i]),
          el("span", null, optText)
        );
      })
    );

    // Render Write-In + Snap-Block Area
    const writeInput = $("#write-input");
    const writeWrap = $("#write-wrap");
    const writePreview = $("#write-preview");
    writeWrap.classList.remove("correct", "wrong");
    if (st.answered) {
      writeInput.value = typeof st.userChoice === "string" ? st.userChoice : q.options[q.correctIndex];
      writeInput.disabled = true;
      writeWrap.classList.add(st.correct ? "correct" : "wrong");
    } else {
      writeInput.value = "";
      writeInput.disabled = false;
    }
    writePreview.textContent = formatChemFormulaPreview(writeInput.value || q.options[q.correctIndex]);
    renderTokenBank(q, st.answered);

    // Explanation drawer
    const explainBox = $("#q-explain");
    if (st.answered) {
      showExplanation(
        st.correct ? "ok" : "err",
        st.correct ? "✓ Spot On!" : `✗ Answer: ${q.options[q.correctIndex]}`,
        q.ruleTag,
        q.explain
      );
    } else {
      explainBox.hidden = true;
    }

    updateActionBtnState(st);
    updateScoreboard(false);
  }

  function submitCurrentAnswer() {
    const q = activeDeck[currentIdx];
    const st = getQuestionState(q.id);
    if (st.answered) {
      if (currentIdx < activeDeck.length - 1) {
        currentIdx++;
        renderQuestion(true);
      } else {
        openScoreReport();
      }
      return;
    }

    let isCorrect = false;
    if (answerMode === "mc") {
      if (selectedOptionIndex == null) {
        showToast("Pick an option (A–D) or click Hint.");
        return;
      }
      st.userChoice = selectedOptionIndex;
      isCorrect = selectedOptionIndex === q.correctIndex;
    } else {
      const raw = $("#write-input").value.trim();
      if (!raw) {
        showToast("Tap blocks or type your answer first.");
        return;
      }
      st.userChoice = raw;
      const norm = normalizeAnswer(raw);
      const validSet = new Set([
        normalizeAnswer(q.options[q.correctIndex]),
        ...(q.acceptedAnswers || []).map(normalizeAnswer)
      ]);
      isCorrect = validSet.has(norm);
    }

    st.answered = true;
    st.correct = isCorrect;
    if (isCorrect) {
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
    renderQuestion(false);
    updateScoreboard(isCorrect);
  }

  $("#write-input")?.addEventListener("input", (e) => {
    const q = activeDeck[currentIdx];
    $("#write-preview").textContent = formatChemFormulaPreview(e.target.value || q?.options[q.correctIndex] || "");
    if (q) updateActionBtnState(getQuestionState(q.id));
  });
  $("#write-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitCurrentAnswer();
    }
  });

  $("#token-back-btn")?.addEventListener("click", () => {
    const inp = $("#write-input");
    if (!inp || inp.disabled) return;
    inp.value = inp.value.trimEnd().replace(/(\S+|\s+)$/, "").trimEnd();
    inp.dispatchEvent(new Event("input"));
  });
  $("#token-clear-btn")?.addEventListener("click", () => {
    const inp = $("#write-input");
    if (!inp || inp.disabled) return;
    inp.value = "";
    inp.dispatchEvent(new Event("input"));
    inp.focus();
  });

  $("#btn-submit-next")?.addEventListener("click", submitCurrentAnswer);
  $("#btn-prev")?.addEventListener("click", () => {
    currentIdx = (currentIdx - 1 + activeDeck.length) % activeDeck.length;
    renderQuestion(true);
  });
  $("#btn-next")?.addEventListener("click", () => {
    currentIdx = (currentIdx + 1) % activeDeck.length;
    renderQuestion(true);
  });
  $("#btn-hint")?.addEventListener("click", () => {
    const q = activeDeck[currentIdx];
    const banner = $("#lab-reveal-banner");
    if (banner) {
      banner.innerHTML = `<b>Hint (${q.ruleTag}):</b> ${q.context}`;
      banner.hidden = false;
    }
  });

  function filterByTopic(topic) {
    for (const btn of $$(".topic-pill")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.topic === topic));
    }
    activeDeck = topic === "all" ? [...QUESTIONS] : QUESTIONS.filter((q) => q.topic === topic);
    currentIdx = 0;
    renderQuestion(true);
  }
  for (const btn of $$(".topic-pill")) {
    btn.addEventListener("click", () => filterByTopic(btn.dataset.topic));
  }

  // Support ?topic=ionic|polyatomic|covalent|acids URL parameter
  const urlTopic = new URLSearchParams(location.search).get("topic");
  if (urlTopic && ["ionic", "polyatomic", "covalent", "acids"].includes(urlTopic)) {
    filterByTopic(urlTopic);
  } else {
    renderQuestion(false);
  }

  // Mode Switch (MC vs. Build & Type)
  $("#mode-mc-btn")?.addEventListener("click", () => {
    answerMode = "mc";
    $("#mode-mc-btn").setAttribute("aria-pressed", "true");
    $("#mode-write-btn").setAttribute("aria-pressed", "false");
    renderQuestion(false);
  });
  $("#mode-write-btn")?.addEventListener("click", () => {
    answerMode = "write";
    $("#mode-mc-btn").setAttribute("aria-pressed", "false");
    $("#mode-write-btn").setAttribute("aria-pressed", "true");
    renderQuestion(false);
    setTimeout(() => $("#write-input")?.focus(), 50);
  });

  $("#btn-shuffle-exam")?.addEventListener("click", () => {
    activeDeck = [...activeDeck].sort(() => Math.random() - 0.5);
    currentIdx = 0;
    setMapDrawerOpen(false);
    renderQuestion(true);
    showToast("Shuffled question order!");
  });

  $("#btn-reset-exam")?.addEventListener("click", () => {
    userState.clear();
    currentStreak = 0;
    currentIdx = 0;
    timerRunning = false;
    clearInterval(timerInterval);
    timerSeconds = 15 * 60;
    timerElapsed = 0;
    updateTimerUI();
    setMapDrawerOpen(false);
    renderQuestion(true);
    showToast("Exam reset. Ready for a fresh run!");
  });

  // Keyboard shortcuts on exam.html
  addEventListener("keydown", (e) => {
    if (e.target.closest("input,textarea,[contenteditable]")) return;
    if ($("dialog[open]")) return;
    const key = e.key.toLowerCase();
    if (answerMode === "mc" && ["a", "b", "c", "d", "1", "2", "3", "4"].includes(key)) {
      const idx = "abcd".includes(key) ? "abcd".indexOf(key) : Number(key) - 1;
      const q = activeDeck[currentIdx];
      const st = getQuestionState(q.id);
      if (!st.answered && idx >= 0 && idx < q.options.length) {
        e.preventDefault();
        selectedOptionIndex = idx;
        submitCurrentAnswer();
      }
    } else if (key === "h") {
      e.preventDefault();
      $("#btn-hint")?.click();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      $("#btn-next")?.click();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      $("#btn-prev")?.click();
    } else if (e.key === "Enter") {
      const q = activeDeck[currentIdx];
      if (getQuestionState(q.id).answered) {
        e.preventDefault();
        submitCurrentAnswer();
      }
    }
  });

  // Score Report Dialog (#report-dialog) with closedby="any" + light-dismiss fallback
  const reportDialog = $("#report-dialog");
  function openScoreReport() {
    if (!reportDialog) return;
    let correct = 0, answered = 0;
    const missed = [];
    for (const q of activeDeck) {
      const st = getQuestionState(q.id);
      if (st.answered) {
        answered++;
        if (st.correct) correct++;
        else missed.push(q);
      } else {
        missed.push(q);
      }
    }
    const pct = activeDeck.length ? Math.round((correct / activeDeck.length) * 100) : 0;
    const grade = pct >= 95 ? "A+" : pct >= 88 ? "A" : pct >= 80 ? "B+" : pct >= 70 ? "B" : pct >= 60 ? "C" : "Review";
    $("#report-grade").textContent = grade;
    $("#rep-score").textContent = `${correct} / ${activeDeck.length}`;
    $("#rep-pct").textContent = `${pct}%`;
    $("#rep-streak").textContent = `${bestStreak} 🔥`;
    $("#rep-time").textContent = timerElapsed > 0
      ? `${Math.floor(timerElapsed / 60)}m ${timerElapsed % 60}s`
      : `${answered} answered`;

    const missedList = $("#report-missed-list");
    if (missed.length === 0) {
      missedList.replaceChildren(
        el("div", { class: "report-missed-item" },
          el("b", null, "🎉 Perfect Score! Every nomenclature rule mastered."),
          el("span", null, "You got 100% across Binary Ionic, Polyatomic Ions, Covalent & Hydrates, and Acids.")
        )
      );
    } else {
      missedList.replaceChildren(
        ...missed.slice(0, 15).map((q) =>
          el("div", { class: "report-missed-item" },
            el("div", { style: { display: "flex", justifyContent: "space-between", gap: "8px" } },
              el("b", { html: `${q.promptHtml} → ${q.options[q.correctIndex]}` }),
              el("span", { style: { font: "600 12px/1 var(--mono)", color: "var(--ink-2)" } }, q.pageRef)
            ),
            el("span", { style: { fontSize: "13.5px", color: "var(--ink-2)" }, html: q.explain })
          )
        )
      );
    }
    reportDialog.showModal();
    if (curEl) reportDialog.append(curEl);
  }

  $("#btn-open-report")?.addEventListener("click", openScoreReport);
  $("#report-close-btn")?.addEventListener("click", () => reportDialog.close());
  $("#report-retry-missed")?.addEventListener("click", () => {
    const missed = activeDeck.filter((q) => !getQuestionState(q.id).correct);
    if (missed.length) {
      for (const q of missed) userState.delete(q.id);
      activeDeck = missed;
      currentIdx = 0;
      renderQuestion(true);
    }
    reportDialog.close();
  });
  reportDialog?.addEventListener("close", () => {
    if (curEl) document.body.append(curEl);
  });
  reportDialog?.addEventListener("click", (e) => {
    if (e.target === reportDialog) reportDialog.close();
  });
}
initFullExam();

// ============================================================================
// 7. INTERACTIVE CHECK POINTS 1–4 DECK (#fallback)
// ============================================================================
function initCheckPoints() {
  const cols = $("#cp-cols");
  const deck = $("#cp-deck");
  if (!cols || !deck) return;

  let currentCpKey = "1";
  let cpRevealKey = false;

  function renderCheckPointDeck() {
    const cp = CHECKPOINTS[currentCpKey];
    if (!cp) return;
    deck.style.setProperty("--cp-accent", cp.accent);

    const buildCol = (colTitle, items, side) =>
      el("div", { class: "cp-card", style: { "--cp-accent": cp.accent } },
        el("h4", null, colTitle),
        ...items.map((item, idx) =>
          el("div", { class: "cp-item" },
            el("span", null, `${item.num}. ${item.prompt}`),
            el("div", { class: "cp-item-row" },
              el("input", {
                type: "text",
                class: "cp-input",
                placeholder: `Type ${colTitle.toLowerCase()}...`,
                "data-side": side,
                "data-idx": String(idx),
                value: cpRevealKey ? item.displayAns : ""
              }),
              cpRevealKey ? el("span", { class: "cp-ans-badge" }, item.displayAns) : null
            )
          )
        )
      );

    cols.replaceChildren(
      buildCol(cp.leftTitle, cp.left, "left"),
      buildCol(cp.rightTitle, cp.right, "right")
    );
    $("#cp-score-label").textContent = cp.title;
  }

  for (const tab of $$(".cp-tab")) {
    tab.addEventListener("click", () => {
      currentCpKey = tab.dataset.cp;
      cpRevealKey = false;
      for (const t of $$(".cp-tab")) t.setAttribute("aria-selected", String(t === tab));
      renderCheckPointDeck();
    });
  }

  $("#cp-check-btn")?.addEventListener("click", () => {
    const cp = CHECKPOINTS[currentCpKey];
    let rightCount = 0;
    for (const inp of $$(".cp-input", cols)) {
      const side = inp.dataset.side;
      const idx = Number(inp.dataset.idx);
      const item = cp[side][idx];
      const norm = normalizeAnswer(inp.value);
      const ok = [normalizeAnswer(item.displayAns), ...item.accepted.map(normalizeAnswer)].includes(norm);
      inp.classList.toggle("ok", ok);
      inp.classList.toggle("err", !ok);
      if (ok) rightCount++;
    }
    $("#cp-score-label").textContent = `Scored ${rightCount} / 6 on Check Point ${currentCpKey}`;
    if (rightCount === 6) showToast(`🎉 Perfect 6/6 on Check Point ${currentCpKey}!`);
  });

  $("#cp-reveal-btn")?.addEventListener("click", () => {
    cpRevealKey = !cpRevealKey;
    $("#cp-reveal-btn").textContent = cpRevealKey ? "Hide Answer Key" : "Show Answer Key";
    renderCheckPointDeck();
  });

  renderCheckPointDeck();
}
initCheckPoints();

// ============================================================================
// 8. FITTING ROOM MIRROR LAB (#tryon) - Swing-Tag Spring Physics + Live Parser
// ============================================================================
const MIX_CLASSES = ["fB", "fI", "fG", "fS", "fD", "fO", "fM", "fK"];

function parseLiveCompoundBreakdown(text) {
  const t = text.trim();
  if (/·|\bhydrate\b/i.test(t)) {
    return [
      ["Class", "Hydrated Ionic Crystal (p. 148)"],
      ["Structure", "Ionic Salt + Trapped H₂O (·nH₂O)"],
      ["Rule", "Name salt + Greek prefix (penta-, hepta-) + hydrate"]
    ];
  }
  if (/^H[A-Z]|acid\b/i.test(t)) {
    const hasOxy = /O|nitric|nitrous|sulfuric|sulfurous|carbonic|iodic|iodous|chloric|chlorous|phosphoric/i.test(t) && !/hydro/i.test(t);
    return hasOxy
      ? [
          ["Class", "Oxyacid (H⁺ + Oxyanion, p. 152–153)"],
          ["Rule", "Never use hydro-! -ate → -ic acid · -ite → -ous acid"],
          ["Examples", "H₂SO₄ sulfuric · HNO₃ nitric · HNO₂ nitrous"]
        ]
      : [
          ["Class", "Binary Acid (H⁺ + Nonmetal in aq, p. 152)"],
          ["Rule", "hydro- + nonmetal root + -ic acid"],
          ["Examples", "HCl(aq) hydrochloric · HI(aq) hydroiodic · HCN hydrocyanic"]
        ];
  }
  if (/\b(mono|di|tri|tetra|penta|hexa|hepta|octa|nona|deca)|^(CO|NO|SO|P₂O₅|P2O5|N₂O|N2O|SF₆|CCl₄)/i.test(t)) {
    return [
      ["Class", "Binary Covalent Compound (2 Nonmetals, p. 147–148)"],
      ["Order", "Less electronegative element first + 2nd root-ide"],
      ["Rule", "Use Greek prefixes · Never mono- on 1st · Drop vowel before oxide"]
    ];
  }
  if (/[()]|PO[₄4]|SO[₄43]|NO[₃32]|CO[₃3]|OH|NH[₄4]|MnO[₄4]|Cr[₂2]O[₇7]|ClO|ate\b|ite\b/i.test(t)) {
    return [
      ["Class", "Ternary Polyatomic Ionic Compound (p. 143–145)"],
      ["Rule", "Metal cation first + unchanged polyatomic ion name"],
      ["Parentheses", "Use ( ) around polyatomic ion ONLY when 2+ units"]
    ];
  }
  return [
    ["Class", "Binary Ionic Compound (Metal + Nonmetal, p. 140–142)"],
    ["Method", "Criss-cross ion charges → reduce to simplest ratio"],
    ["Rule", "Cation name + anion root-ide (use Roman numeral / -ous -ic if variable)"]
  ];
}

function initTryOnMirror() {
  const textEl = $("#to-text");
  const stripEl = $("#to-strip");
  const dockEl = $("#to-dock");
  const toLabel = $("#to-to");
  const breakdownEl = $("#to-breakdown");
  if (!textEl || !stripEl) return;

  const state = {
    kept: MIRROR_CLASSES[0],
    trying: null,
    comparing: false,
    scale: 1,
    track: 0,
    customWords: null
  };

  const activeFace = () => (state.comparing ? MIRROR_CLASSES[0] : state.trying ?? state.kept);
  let prevFace = null;

  const mirrorEl = $(".to-mirror");

  function renderMirrorBreakdown(pills) {
    if (!breakdownEl || !Array.isArray(pills)) return;
    breakdownEl.replaceChildren(
      ...pills.map(([k, v], idx) => {
        const pill = el("span", { class: "to-chem-pill", style: `--i:${idx}` }, el("b", null, `${k}:`), " ", v);
        pill.addEventListener("click", () => {
          state.comparing = !state.comparing;
          state.customWords = null;
          prevFace = null;
          applyMirror();
        });
        return pill;
      })
    );
  }

  if (mirrorEl && !reducedMotion && finePointer) {
    mirrorEl.addEventListener("pointermove", (e) => {
      const r = mirrorEl.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      mirrorEl.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      mirrorEl.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      mirrorEl.style.setProperty("--tilt-x", `${((0.5 - py) * 4.2).toFixed(2)}deg`);
      mirrorEl.style.setProperty("--tilt-y", `${((px - 0.5) * 4.8).toFixed(2)}deg`);
    }, { passive: true });
    mirrorEl.addEventListener("pointerleave", () => {
      mirrorEl.style.setProperty("--tilt-x", "0deg");
      mirrorEl.style.setProperty("--tilt-y", "0deg");
    });
  }

  function applyMirror() {
    const f = activeFace();
    const displayWords = state.customWords || (state.comparing ? f.altText : f.formulaText);
    const st = textEl.style;

    if (f.mix) {
      textEl.replaceChildren(
        ...[...displayWords].map((ch, idx) =>
          ch === " "
            ? el("span", { class: "to-sp" }, " ")
            : el("i", { class: MIX_CLASSES[idx % MIX_CLASSES.length] }, ch)
        )
      );
      Object.assign(st, { fontFamily: "", fontWeight: "", fontStyle: "", fontStretch: "" });
      st.setProperty("--to-size", state.scale * 0.92);
      st.letterSpacing = `${state.track}em`;
    } else {
      if (document.activeElement !== textEl) textEl.textContent = displayWords;
      Object.assign(st, {
        fontFamily: f.family,
        fontWeight: f.weight,
        fontStyle: f.style ?? "normal",
        fontStretch: f.stretch ?? "100%"
      });
      st.setProperty("--to-size", (f.size ?? 1) * state.scale);
      st.letterSpacing = `${(f.track ?? 0) + state.track}em`;
    }

    renderMirrorBreakdown(
      state.customWords
        ? parseLiveCompoundBreakdown(state.customWords)
        : (f.breakdown || parseLiveCompoundBreakdown(displayWords))
    );

    if (prevFace !== f && !reducedMotion) {
      textEl.animate(
        [
          { opacity: 0.35, transform: "translateY(10px) scale(0.95)", filter: "blur(3px)" },
          { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0px)" }
        ],
        { duration: 300, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
      );
      if (mirrorEl) {
        mirrorEl.classList.remove("mirror-pulse");
        void mirrorEl.offsetWidth;
        mirrorEl.classList.add("mirror-pulse");
      }
    }
    prevFace = f;
    dockEl.toggleAttribute("data-comparing", state.comparing);
    toLabel.textContent = `${f.name} (${f.tag})`;
    toLabel.classList.add("picked");

    for (const { f: itemF, tile } of tiles) {
      tile.setAttribute("aria-selected", String(itemF === state.kept));
      tile.toggleAttribute("data-trying", itemF === state.trying && itemF !== state.kept);
    }
  }

  const tiles = MIRROR_CLASSES.map((f) => {
    const sample = el("span", { class: "to-sample" }, f.sample);
    if (!f.mix) {
      Object.assign(sample.style, {
        fontFamily: f.family,
        fontWeight: f.weight,
        fontStyle: f.style ?? "normal",
        fontSize: "28px"
      });
    } else {
      sample.style.fontSize = "26px";
    }
    const tile = el("button", {
      class: "to-tile",
      type: "button",
      role: "option",
      tabindex: "-1",
      "data-original": f.original
    },
      sample,
      el("span", { class: "to-name" }, el("b", null, f.name), el("span", null, f.tag))
    );
    tile.addEventListener("mousedown", (e) => e.preventDefault());
    tile.addEventListener("click", () => {
      state.kept = f;
      state.trying = null;
      state.customWords = null;
      prevFace = null;
      applyMirror();
    });
    tile.addEventListener("mouseenter", () => {
      if (finePointer) {
        state.trying = f;
        applyMirror();
      }
    });
    stripEl.append(tile);
    return { f, tile, sample };
  });

  stripEl.addEventListener("mouseleave", () => {
    if (state.trying) {
      state.trying = null;
      applyMirror();
    }
  });

  // 1:1 Swing-Tag Spring Physics
  if (!reducedMotion && finePointer) {
    const restAngles = tiles.map((_, i) => (i % 2 ? 1.5 : -1.5));
    const springs = tiles.map((_, i) => ({ a: restAngles[i], v: 0, y: 0, vy: 0, lift: 0 }));
    let rafId = 0, lastT = 0, lastX = 0, velX = 0, lastMoveT = 0;

    stripEl.addEventListener("pointermove", (e) => {
      const now = performance.now();
      if (lastMoveT) velX = (e.clientX - lastX) / Math.max(8, now - lastMoveT);
      lastX = e.clientX;
      lastMoveT = now;
    }, { passive: true });

    tiles.forEach(({ tile }, idx) => {
      tile.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "mouse") {
          springs[idx].v += clamp(velX * 0.9, -1, 1) * -110 || -30;
          springs[idx].lift = 1;
          wakeSwing();
        }
      });
      tile.addEventListener("pointerleave", () => {
        springs[idx].lift = 0;
        wakeSwing();
      });
    });

    function stepSwing(now) {
      const dt = Math.min(0.032, (now - (lastT || now)) / 1000) || 0.016;
      lastT = now;
      let moving = false;
      springs.forEach((s, i) => {
        if (Math.abs(s.a - restAngles[i]) > 0.02 || Math.abs(s.v) > 0.05 || Math.abs(s.y + s.lift * 5) > 0.02 || Math.abs(s.vy) > 0.05) {
          moving = true;
          s.v += (-90 * (s.a - restAngles[i]) - 7.5 * s.v) * dt;
          s.a += s.v * dt;
          s.vy += (-160 * (s.y - s.lift * -5) - 22 * s.vy) * dt;
          s.y += s.vy * dt;
          tiles[i].tile.style.transform = `translateY(${s.y.toFixed(2)}px) rotate(${s.a.toFixed(2)}deg)`;
        }
      });
      rafId = moving ? requestAnimationFrame(stepSwing) : 0;
      if (!rafId) lastT = 0;
    }
    function wakeSwing() {
      rafId ||= requestAnimationFrame(stepSwing);
    }
  }

  let tryOnVisible = false;
  new IntersectionObserver(([entry]) => {
    tryOnVisible = entry.isIntersecting;
  }, { threshold: 0.3 }).observe(dockEl);

  addEventListener("keydown", (e) => {
    if (e.key === "Shift" && tryOnVisible && !e.repeat && document.activeElement !== textEl) {
      state.comparing = true;
      applyMirror();
    }
  });
  addEventListener("keyup", (e) => {
    if (e.key === "Shift" && state.comparing) {
      state.comparing = false;
      applyMirror();
    }
  });

  $(".to-hint")?.addEventListener("click", () => {
    textEl.focus();
    const range = document.createRange();
    range.selectNodeContents(textEl);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });

  textEl.addEventListener("input", () => {
    state.customWords = textEl.textContent.trim();
    renderMirrorBreakdown(parseLiveCompoundBreakdown(state.customWords || state.kept.formulaText));
  });

  function makeScrubber(label, getVal, setVal, min, max, step, fmt, defVal) {
    const valSpan = el("span", { class: "to-val" });
    const btn = el("button", {
      class: "to-scrub",
      type: "button",
      title: `${label}: drag sideways · double-click to reset`
    }, el("span", null, label), valSpan);

    const sync = () => {
      valSpan.textContent = fmt(getVal());
      btn.toggleAttribute("data-changed", getVal() !== defVal);
    };
    const update = (v) => {
      setVal(clamp(Math.round(v / step) * step, min, max));
      sync();
      applyMirror();
    };
    btn.addEventListener("pointerdown", (e) => {
      const startX = e.clientX;
      const startV = getVal();
      btn.setPointerCapture(e.pointerId);
      const onMove = (me) => update(startV + ((me.clientX - startX) / 220) * (max - min));
      const onUp = () => {
        btn.removeEventListener("pointermove", onMove);
        btn.removeEventListener("pointerup", onUp);
      };
      btn.addEventListener("pointermove", onMove);
      btn.addEventListener("pointerup", onUp);
    });
    btn.addEventListener("dblclick", () => update(defVal));
    sync();
    return btn;
  }

  $("#to-scrubs")?.append(
    makeScrubber("Size", () => Math.round(state.scale * 100), (v) => { state.scale = v / 100; }, 65, 135, 1, (v) => `${v}%`, 100),
    makeScrubber("Tracking", () => Math.round(state.track * 1000) / 10, (v) => { state.track = v / 100; }, -6, 12, 0.5, (v) => `${v}%`, 0)
  );

  applyMirror();
}
initTryOnMirror();

// ============================================================================
// 9. TEST DRIVE SPECIMEN WORKBENCH (#test)
// ============================================================================
function initTestDrive() {
  const tdEl = $("#td");
  if (!tdEl) return;
  const sizeInput = $("#td-size");
  const textInput = $("#td-text");

  for (const tab of $$(".td-tabs [data-v]", tdEl)) {
    tab.addEventListener("click", () => {
      tdEl.dataset.view = tab.dataset.v;
      for (const t of $$(".td-tabs [data-v]", tdEl)) {
        t.setAttribute("aria-selected", String(t === tab));
      }
    });
  }

  sizeInput?.addEventListener("input", () => {
    tdEl.style.setProperty("--td-size", `${sizeInput.value}px`);
    $("#td-size-v").textContent = `${sizeInput.value} px`;
  });

  for (const mBtn of $$("[data-mask-btn]", tdEl)) {
    mBtn.addEventListener("click", () => {
      tdEl.dataset.mask = mBtn.dataset.maskBtn;
      for (const b of $$("[data-mask-btn]", tdEl)) {
        b.setAttribute("aria-pressed", String(b === mBtn));
      }
      for (const c of $$(".td-quiz-cell.revealed", tdEl)) {
        c.classList.remove("revealed");
      }
    });
  }

  tdEl.addEventListener("click", (e) => {
    const cell = e.target.closest(".td-quiz-cell");
    if (cell && tdEl.dataset.mask !== "none") {
      cell.classList.toggle("revealed");
    }
  });

  for (const thBtn of $$("[data-th]", tdEl)) {
    thBtn.addEventListener("click", () => {
      tdEl.dataset.theme = thBtn.dataset.th;
      for (const b of $$("[data-th]", tdEl)) {
        b.setAttribute("aria-pressed", String(b === thBtn));
      }
    });
  }

  textInput?.addEventListener("input", () => {
    const q = textInput.value.trim().toLowerCase();
    for (const row of $$(".td-row", tdEl)) {
      row.hidden = !!q && !row.textContent.toLowerCase().includes(q);
    }
  });

  const ionGrid = $("#td-ion-grid");
  const bigSym = $("#td-big-sym");
  const bigMeta = $("#td-big-meta");
  if (ionGrid) {
    ionGrid.replaceChildren(
      ...ION_GRID_ITEMS.map((item, idx) => {
        const btn = el("button", {
          type: "button",
          "data-g": item.sym,
          "data-on": idx === 16 ? "" : null,
          style: { fontSize: "15px", fontWeight: "700", padding: "8px 4px", height: "48px" }
        }, item.sym);
        const activate = () => {
          bigSym.textContent = item.sym;
          bigMeta.textContent = item.meta;
          for (const b of $$("button", ionGrid)) b.toggleAttribute("data-on", b === btn);
        };
        btn.addEventListener("mouseenter", activate);
        btn.addEventListener("focus", activate);
        btn.addEventListener("click", activate);
        return btn;
      })
    );
  }

  $("#td-export")?.addEventListener("click", async () => {
    const summary = "G11 Chemical Nomenclature Study Sheet (pp. 140–153)\n• Binary Ionic: Cation + Anion root-ide (criss-cross & reduce)\n• Stock vs Classical: Fe2+ ferrous/iron(II), Fe3+ ferric/iron(III)\n• Polyatomics: NH4+, OH-, NO3-, NO2-, SO4 2-, SO3 2-, CO3 2-, PO4 3-\n• Binary Covalent: Greek prefixes (1-10), no mono- on 1st\n• Binary Acids: hydro- + root + -ic acid\n• Oxyacids: -ate → -ic acid, -ite → -ous acid";
    try {
      await navigator.clipboard.writeText(summary);
      showToast("Copied G11 Nomenclature Study Sheet to clipboard!");
    } catch {
      showToast("Study sheet ready!");
    }
  });
}
initTestDrive();

// ============================================================================
// 10. MATTER.JS 2D PHYSICS PIT (#pit) & 3D ROLODEX DIALOG (#rolo)
// ============================================================================
function initPhysicsPit() {
  const pitEl = $("#pit");
  const tipEl = $("#tip");
  if (!pitEl) return;

  for (const tag of $$(".tag[data-place]", pitEl)) {
    tag.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse" && tipEl) {
        tipEl.textContent = tag.dataset.place;
        tipEl.hidden = false;
      }
    });
    tag.addEventListener("pointerleave", () => {
      if (tipEl) tipEl.hidden = true;
    });
  }
  addEventListener("scroll", () => { if (tipEl) tipEl.hidden = true; }, { passive: true });
  pitEl.addEventListener("pointermove", (e) => {
    if (tipEl && !tipEl.hidden) {
      tipEl.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 16}px)`;
    }
  });

  if (reducedMotion) {
    $("#pit-hint").hidden = true;
    return;
  }

  let MatterLib = null;
  let started = false;
  let inView = false;
  let setRunning = null;

  const tryBoot = () => {
    if (inView && MatterLib && !started) {
      started = true;
      bootMatterPit(MatterLib);
    }
  };

  const preloadObs = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      preloadObs.disconnect();
      import("./assets/matter.js")
        .then((m) => {
          MatterLib = m.default || m;
          tryBoot();
        })
        .catch(() => {
          $("#pit-hint").hidden = true;
        });
    }
  }, { rootMargin: "1200px 0px" });
  preloadObs.observe(pitEl);

  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    tryBoot();
    setRunning?.(inView);
  }, { threshold: 0, rootMargin: "0px 0px 12% 0px" }).observe(pitEl);

  function bootMatterPit(Matter) {
    const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint, Query, Events } = Matter;
    let W = pitEl.clientWidth;
    let H = pitEl.clientHeight;
    let budget = W * H * (innerWidth < 640 ? 0.6 : 0.52);
    const items = [];

    for (const t of $$(".tag", pitEl)) {
      const w = t.offsetWidth, h = t.offsetHeight;
      if ((budget -= w * h * 1.12) < 0) t.remove();
      else items.push({ t, w, h, body: null });
    }

    pitEl.classList.add("live");
    for (const it of items) it.t.style.visibility = "hidden";

    const engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
    engine.gravity.y = 1.1;

    const floor = Bodies.rectangle(W / 2, H - 18 + 200, W * 3, 400, { isStatic: true });
    const leftWall = Bodies.rectangle(-182, H / 2, 400, H * 8, { isStatic: true });
    const rightWall = Bodies.rectangle(W - 18 + 200, H / 2, 400, H * 8, { isStatic: true });
    Composite.add(engine.world, [floor, leftWall, rightWall]);

    const bodies = [];
    let heldBody = null;

    items.slice().sort(() => Math.random() - 0.5).forEach((it, idx) => {
      setTimeout(() => {
        const x = it.w / 2 + 26 + Math.random() * Math.max(1, W - it.w - 52);
        const body = Bodies.rectangle(x, -it.h / 2 - Math.random() * 60, it.w, it.h, {
          chamfer: { radius: Math.min(it.h / 2 - 1, 22) },
          restitution: 0.08,
          friction: 0.7,
          frictionStatic: 1,
          frictionAir: 0.03,
          density: 0.0018,
          angle: (Math.random() - 0.5) * 0.36,
          sleepThreshold: 36
        });
        Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.04);
        Body.setVelocity(body, { x: (Math.random() - 0.5) * 1.5, y: 5 + Math.random() * 3 });
        it.body = body;
        it.px = body.position.x;
        it.py = body.position.y;
        it.pa = body.angle;
        bodies.push(body);
        Composite.add(engine.world, body);
        it.t.style.visibility = "";
      }, idx * 50);
    });

    if (finePointer) {
      const mouse = Mouse.create(pitEl);
      for (const evName of ["wheel", "mousewheel", "DOMMouseScroll"]) {
        pitEl.removeEventListener(evName, mouse.mousewheel);
      }
      const mc = MouseConstraint.create(engine, {
        mouse,
        constraint: { stiffness: 0.16, damping: 0.08, render: { visible: false } }
      });
      Composite.add(engine.world, mc);
      const findItem = (b) => items.find((i) => i.body === b);
      Events.on(mc, "startdrag", ({ body }) => {
        heldBody = body;
        findItem(body)?.t.classList.add("held");
      });
      Events.on(mc, "enddrag", ({ body }) => {
        heldBody = null;
        findItem(body)?.t.classList.remove("held");
      });
    } else {
      pitEl.addEventListener("pointerdown", (e) => {
        const r = pitEl.getBoundingClientRect();
        const hit = Query.point(bodies, { x: e.clientX - r.left, y: e.clientY - r.top })[0];
        if (hit) {
          Matter.Sleeping.set(hit, false);
          Body.setVelocity(hit, { x: (Math.random() - 0.5) * 14, y: -18 });
          setRunning?.(true);
        }
      });
    }

    const STEP = 1000 / 60;
    let accum = 0, lastTime = 0, raf = 0;
    function loop(now) {
      for (accum += Math.min(100, now - (lastTime || now)), lastTime = now; accum >= STEP; ) {
        for (const it of items) {
          const b = it.body;
          if (b) {
            it.px = b.position.x;
            it.py = b.position.y;
            it.pa = b.angle;
            if (b !== heldBody && !b.isSleeping && b.speed > 1.2) {
              Body.setAngularVelocity(b, b.angularVelocity * 0.97 - Math.sin(b.angle) * 0.0015);
            }
          }
        }
        Engine.update(engine, STEP);
        accum -= STEP;
      }
      const alpha = accum / STEP;
      for (const it of items) {
        const b = it.body;
        if (!b || (b.isSleeping && it.asleep)) continue;
        const x = it.px + (b.position.x - it.px) * alpha;
        const y = it.py + (b.position.y - it.py) * alpha;
        const a = it.pa + (b.angle - it.pa) * alpha;
        it.t.style.transform = `translate3d(${(x - it.w / 2).toFixed(2)}px, ${(y - it.h / 2).toFixed(2)}px, 0) rotate(${a.toFixed(4)}rad)`;
        it.asleep = b.isSleeping;
      }
      raf = heldBody || items.some((i) => !i.body || !i.body.isSleeping) ? requestAnimationFrame(loop) : 0;
    }

    pitEl.addEventListener("pointerdown", () => setRunning?.(true));
    setRunning = (run) => {
      if (run && !raf) {
        lastTime = 0;
        accum = 0;
        raf = requestAnimationFrame(loop);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    setRunning(true);
  }
}
initPhysicsPit();

// 3D Rolodex Flashcards (#rolo)
function initRolodex() {
  const roloDialog = $("#rolo");
  const wheelEl = $("#rolo-wheel");
  const stageEl = $("#rolo-stage");
  const tabsEl = $("#rolo-tabs");
  const countEl = $("#rolo-count");
  const searchInput = $("#rolo-q");
  if (!roloDialog || !wheelEl) return;

  let filtered = [...ROLODEX_CARDS];
  let pos = 0, targetPos = 0, raf = 0, filterKind = "all", wheelSnapTimer = 0;
  const renderedCards = new Map();
  const firstLetter = (s) => (/[a-z]/i.test(s[0]) ? s[0].toUpperCase() : "#");

  function createCardNode(idx) {
    const r = filtered[idx];
    const ltr = firstLetter(r.name);
    const badge = el("span", { class: "rc-fav none" }, ltr);
    const metaParts = r.kind === "brand" ? [r.by] : [r.place, `${r.count || 2} ions/atoms`];
    const card = el("article", { class: "rcard", style: { "--tx": ((idx % 5) / 4).toFixed(2) } },
      el("span", { class: "tab", "aria-hidden": "true" }, ltr),
      el("div", { class: "rc-head" },
        badge,
        el("span", { class: `rc-tag ${r.kind === "brand" ? "brand" : "major"}` }, r.kind === "brand" ? "Covalent / Acid" : "Ionic / Salt")
      ),
      el("div", { class: "rc-name" }, r.name),
      el("div", { class: "rc-meta" }, metaParts.filter(Boolean).join(" · ")),
      el("div", { class: "rc-fams" }, (r.families || []).map((f) => el("span", null, f))),
      el("div", { class: "rc-foot" },
        el("span", null, "G11 Chemistry 1 · pp. 140–153"),
        el("span", null, "Verified Rule")
      ),
      el("span", { class: "slots", "aria-hidden": "true" })
    );
    card.addEventListener("click", (e) => {
      if (idx !== Math.round(pos)) {
        e.preventDefault();
        scrollToIndex(idx);
      }
    });
    wheelEl.append(card);
    renderedCards.set(idx, card);
    return card;
  }

  function layoutWheel() {
    const base = Math.floor(pos);
    const active = Math.round(pos);
    for (const [k, node] of renderedCards) {
      if (k < base - 1 || k > base + 10) {
        node.remove();
        renderedCards.delete(k);
      }
    }
    for (let i = Math.max(0, base - 1); i <= Math.min(filtered.length - 1, base + 10); i++) {
      const node = renderedCards.get(i) || createCardNode(i);
      const rel = i - pos;
      const posRel = Math.max(0, rel);
      const stackOffset = Math.min(posRel, 8);
      const rotX = rel < 0 ? -7 + rel * 95 : -7 + Math.min(posRel * 4, 24);
      node.style.transform = `translateY(${(-stackOffset * 15).toFixed(1)}px) translateZ(${(-posRel * 22).toFixed(1)}px) rotateX(${Math.max(-100, rotX).toFixed(2)}deg)`;
      node.style.zIndex = String(rel < 0 ? 300 : 200 - Math.round(rel * 10));
      node.style.opacity = rel < -0.95 ? "0" : String(Math.max(0, Math.min(1, 1 - (rel - 6) / 3)));
      node.style.setProperty("--shade", Math.max(0, Math.min(0.5, rel * 0.06)).toFixed(3));
      const isFront = i === active;
      node.inert = !isFront;
      node.setAttribute("aria-hidden", String(!isFront));
    }
    countEl.textContent = filtered.length ? `${active + 1} of ${filtered.length}` : "";
    const curLtr = filtered[active] && firstLetter(filtered[active].name);
    for (const btn of tabsEl.children) {
      btn.setAttribute("aria-current", String(btn.textContent === curLtr));
    }
  }

  function stepWheel() {
    raf = 0;
    pos += (targetPos - pos) * (reducedMotion ? 1 : 0.2);
    if (Math.abs(targetPos - pos) < 0.002) pos = targetPos;
    layoutWheel();
    if (pos !== targetPos) raf = requestAnimationFrame(stepWheel);
  }

  function scrollToIndex(idx) {
    targetPos = clamp(idx, 0, Math.max(0, filtered.length - 1));
    raf ||= requestAnimationFrame(stepWheel);
  }

  function rebuildList() {
    const q = searchInput.value.trim().toLowerCase();
    filtered = ROLODEX_CARDS.filter((r) =>
      (filterKind === "all" || r.kind === filterKind) &&
      (!q || [r.name, r.place, r.by, ...(r.families || [])].some((s) => s && s.toLowerCase().includes(q)))
    );
    for (const node of renderedCards.values()) node.remove();
    renderedCards.clear();
    pos = targetPos = 0;
    $("#rolo-empty").hidden = filtered.length > 0;
    const letters = [...new Set(filtered.map((r) => firstLetter(r.name)))];
    tabsEl.replaceChildren(
      ...letters.map((l) =>
        el("button", { type: "button", onclick: () => scrollToIndex(filtered.findIndex((r) => firstLetter(r.name) === l)) }, l)
      )
    );
    layoutWheel();
  }

  $("#rolo-open")?.addEventListener("click", () => {
    roloDialog.showModal();
    stageEl.focus({ preventScroll: true });
    document.documentElement.classList.add("rolo-on");
    if (curEl) roloDialog.append(curEl);
    rebuildList();
  });

  $("#rolo-x")?.addEventListener("click", () => roloDialog.close());
  roloDialog.addEventListener("close", () => {
    document.documentElement.classList.remove("rolo-on");
    if (curEl) document.body.append(curEl);
  });
  // Fallback light-dismiss for browsers without native closedby="any"
  roloDialog.addEventListener("click", (e) => {
    if (e.target === roloDialog) roloDialog.close();
  });

  searchInput?.addEventListener("input", rebuildList);
  for (const chip of $$(".rolo-chips button")) {
    chip.addEventListener("click", () => {
      filterKind = chip.dataset.f;
      for (const c of $$(".rolo-chips button")) c.setAttribute("aria-checked", String(c === chip));
      rebuildList();
    });
  }

  stageEl.addEventListener("wheel", (e) => {
    e.preventDefault();
    scrollToIndex(targetPos + (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) / 80);
    clearTimeout(wheelSnapTimer);
    wheelSnapTimer = setTimeout(() => scrollToIndex(Math.round(targetPos)), 120);
  }, { passive: false });

  let dragState = null;
  stageEl.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("a,button")) {
      dragState = { y: e.clientY, start: targetPos, id: e.pointerId };
      stageEl.setPointerCapture(e.pointerId);
    }
  });
  stageEl.addEventListener("pointermove", (e) => {
    if (dragState) scrollToIndex(dragState.start + (dragState.y - e.clientY) / 60);
  });
  const endDrag = () => {
    if (dragState) {
      dragState = null;
      scrollToIndex(Math.round(targetPos));
    }
  };
  stageEl.addEventListener("pointerup", endDrag);
  stageEl.addEventListener("pointercancel", endDrag);

  roloDialog.addEventListener("keydown", (e) => {
    const inSearch = e.target === searchInput;
    if (["ArrowDown", "ArrowRight", "PageDown"].includes(e.key) && !(inSearch && e.key === "ArrowRight")) {
      e.preventDefault();
      scrollToIndex(Math.round(targetPos) + 1);
    } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key) && !(inSearch && e.key === "ArrowLeft")) {
      e.preventDefault();
      scrollToIndex(Math.round(targetPos) - 1);
    }
  });
}
initRolodex();

// ============================================================================
// 11. 3D MECHANICAL KEYCAPS (Alt+Shift+F) + GIANT FOOTER FLASHLIGHT
// ============================================================================
const downKeys = new Set();
function syncBigKeys() {
  for (const k of $$(".key")) k.classList.toggle("down", downKeys.has(k.dataset.k));
}

addEventListener("keydown", (e) => {
  if (e.key === "Alt") downKeys.add("alt");
  if (e.key === "Shift") downKeys.add("shift");
  if (e.code === "KeyF") downKeys.add("f");
  syncBigKeys();

  if (e.code === "KeyF" && e.altKey && e.shiftKey) {
    e.preventDefault();
    if (!document.body.classList.contains("exam-page")) {
      (window.ctGo || ((u) => (location.href = u)))("./exam.html");
    }
  }
});

addEventListener("keyup", (e) => {
  if (e.key === "Alt") downKeys.delete("alt");
  if (e.key === "Shift") downKeys.delete("shift");
  if (e.code === "KeyF") downKeys.delete("f");
  syncBigKeys();
});

addEventListener("blur", () => {
  downKeys.clear();
  syncBigKeys();
});

$("#keys")?.addEventListener("click", () => {
  (window.ctGo || ((u) => (location.href = u)))("./exam.html");
});
$("#hint")?.addEventListener("click", () => {
  (window.ctGo || ((u) => (location.href = u)))("./exam.html");
});

// Giant Footer Wordmark Radial Flashlight (#giant)
const giantEl = $("#giant");
giantEl?.addEventListener("pointermove", (e) => {
  const r = giantEl.getBoundingClientRect();
  giantEl.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
  giantEl.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
}, { passive: true });

// Pointer-Origin Hover Ripple Coordinates (--rx, --ry) for Buttons & .issue Cards
const RIPPLE_SEL = ".btn, .nav-links a, .ms-btn, .ms-btn-ghost, .qd-tab, .qd-opt, .cp-tab, .to-hint, .to-chem-pill, .td-get, .ct-copy, .foot-links a, .nav-back, .exam-timer-btn, .btn-yellow, .topic-pill, .mode-switch button, .mc-opt, .ms-btn-secondary, .ms-btn-action, .q-util-btn, .hud-map-btn, .side-mini-btn, .issue";
function updateRippleCoords(e) {
  const t = e.target.closest?.(RIPPLE_SEL);
  if (!t) return;
  const r = t.getBoundingClientRect();
  if (!r.width || !r.height) return;
  t.style.setProperty("--rx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
  t.style.setProperty("--ry", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
}
addEventListener("pointerover", updateRippleCoords, { passive: true });
addEventListener("pointermove", updateRippleCoords, { passive: true });

// Animated .issues Cards (Scroll-Reveal Cascade + Hover/Click Formula Swap)
const issuesGrid = $("#issues-grid");
if (issuesGrid) {
  const cards = $$(".issue", issuesGrid);
  if (!reducedMotion) {
    issuesGrid.classList.add("reveal-ready");
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          cards.forEach((c) => c.classList.add("in-view"));
          io.disconnect();
        }
      }
    }, { threshold: 0.18 });
    io.observe(issuesGrid);
  } else {
    cards.forEach((c) => c.classList.add("in-view"));
  }

  cards.forEach((card) => {
    const spec = $(".spec", card);
    if (!spec) return;
    const orig = spec.dataset.orig || spec.textContent;
    const alt = spec.dataset.alt || orig;
    const flipSpec = (toText) => {
      if (spec.textContent === toText) return;
      spec.textContent = toText;
      if (!reducedMotion) {
        spec.animate(
          [
            { opacity: 0.3, transform: "translateY(8px) scale(0.92)" },
            { opacity: 1, transform: "translateY(-2px) scale(1.04) rotate(-1deg)" }
          ],
          { duration: 280, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
        );
      }
    };
    card.addEventListener("pointerenter", () => flipSpec(alt));
    card.addEventListener("mouseenter", () => flipSpec(alt));
    card.addEventListener("pointerleave", () => flipSpec(orig));
    card.addEventListener("mouseleave", () => flipSpec(orig));
    card.addEventListener("click", () => flipSpec(spec.textContent === orig ? alt : orig));
  });
}
