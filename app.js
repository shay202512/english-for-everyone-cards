(function () {
  "use strict";
  const PAGES = window.PAGES || [];
  const META = window.META || {};
  const deck = document.getElementById("deck");
  const emptyEl = document.getElementById("empty");
  const searchEl = document.getElementById("search");
  const themeEl = document.getElementById("theme");
  const counterEl = document.getElementById("counter");
  const posEl = document.getElementById("pos");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxClose = document.getElementById("lightbox-close");

  let query = "";
  let themeFilter = "";
  let visible = [];      // currently shown page objects, in order
  let current = 0;

  // ---- helpers ----
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function normalize(s) { return String(s || "").toLowerCase(); }

  // ---- TTS ----
  let voice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const vs = speechSynthesis.getVoices();
    voice = vs.find(v => /en[-_]US/i.test(v.lang)) ||
            vs.find(v => /^en/i.test(v.lang)) || null;
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  function speak(text) {
    if (!("speechSynthesis" in window) || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    if (voice) u.voice = voice;
    u.rate = 0.95;
    speechSynthesis.speak(u);
  }

  // ---- theme list ----
  function buildThemes() {
    const seen = [];
    const set = new Set();
    PAGES.forEach(p => {
      const t = p.title || "";
      if (t && !set.has(t)) { set.add(t); seen.push(t); }
    });
    seen.forEach(t => {
      const o = document.createElement("option");
      o.value = t; o.textContent = t;
      themeEl.appendChild(o);
    });
  }

  // ---- matching ----
  function wordMatches(w, q) {
    if (!q) return true;
    return normalize(w.word).includes(q) ||
           normalize(w.ipa).includes(q) ||
           normalize(w.pos).includes(q) ||
           normalize(w.definition).includes(q);
  }
  function pageMatches(p, q, th) {
    if (th && p.title !== th) return false;
    if (!q) return true;
    return p.words.some(w => wordMatches(w, q));
  }

  // ---- render ----
  function cardHTML(p, q) {
    const words = p.words.map(w => {
      const hit = q && wordMatches(w, q) ? " hit" : "";
      const ipa = w.ipa ? `<span class="ipa">/${esc(w.ipa)}/</span>` : "";
      const pos = w.pos ? `<span class="pos">${esc(w.pos)}</span>` : "";
      const def = w.definition ? `<span class="def">${esc(w.definition)}</span>` : "";
      return `<div class="word${hit}">
        <button class="speak" data-word="${esc(w.word)}" title="朗读">🔊</button>
        <span class="w">${esc(w.word)}</span>
        ${ipa}${pos}${def ? `<span style="flex-basis:100%"></span>${def}` : ""}
      </div>`;
    }).join("");
    return `<section class="card" data-page="${p.page}">
      <div class="card-head">
        <h2>${esc(p.title || "未命名")}</h2>
        <span class="page">p.${p.page}</span>
      </div>
      <div class="card-body">
        <div class="illus"><img loading="lazy" src="${esc(p.image)}" alt="${esc(p.title || "")}" onerror="this.style.display='none';this.nextElementSibling||(this.insertAdjacentHTML('afterend','<span style=\'color:var(--muted);padding:20px\'>图片加载失败</span>'))"></div>
        <div class="words">${words || '<div class="word"><span class="w" style="color:var(--muted)">（本页未解析到词条）</span></div>'}</div>
      </div>
    </section>`;
  }

  function render() {
    visible = PAGES.filter(p => pageMatches(p, query, themeFilter));
    deck.innerHTML = visible.map(p => cardHTML(p, query)).join("");
    emptyEl.hidden = visible.length > 0;
    counterEl.textContent = `显示 ${visible.length} / 共 ${PAGES.length} 张`;
    current = 0;
    updatePos();
    deck.scrollTop = 0;
  }

  function updatePos() {
    posEl.textContent = visible.length ? `${current + 1} / ${visible.length}` : "0 / 0";
  }
  function goto(idx) {
    if (!visible.length) return;
    idx = Math.max(0, Math.min(idx, visible.length - 1));
    current = idx;
    const cards = deck.querySelectorAll(".card");
    if (cards[idx]) cards[idx].scrollIntoView({ behavior: "smooth", block: "start" });
    updatePos();
  }

  // ---- events ----
  searchEl.addEventListener("input", e => {
    query = normalize(e.target.value.trim());
    render();
  });
  themeEl.addEventListener("change", e => {
    themeFilter = e.target.value;
    render();
  });
  prevBtn.addEventListener("click", () => goto(current - 1));
  nextBtn.addEventListener("click", () => goto(current + 1));

  deck.addEventListener("click", e => {
    const sp = e.target.closest(".speak");
    if (sp) { speak(sp.dataset.word); return; }
    const img = e.target.closest(".illus img");
    if (img && img.naturalWidth > 0 && img.src) {   // only open lightbox for loaded images
      lightboxImg.src = img.src;
      lightbox.hidden = false;
    }
  });
  lightboxClose.addEventListener("click", () => { lightbox.hidden = true; });
  lightbox.addEventListener("click", e => { if (e.target === lightbox) lightbox.hidden = true; });

  document.addEventListener("keydown", e => {
    if (e.target === searchEl) {
      if (e.key === "Escape") { searchEl.value = ""; query = ""; render(); }
      return;
    }
    if (e.key === "/") { e.preventDefault(); searchEl.focus(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); goto(current + 1); }
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); goto(current - 1); }
    else if (e.key === "Escape") { lightbox.hidden = true; }
  });

  // track currently centered card for the pager position
  deck.addEventListener("scroll", () => {
    const cards = deck.querySelectorAll(".card");
    const mid = deck.scrollTop + deck.clientHeight / 2;
    let best = 0, bestD = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(c.offsetTop + c.offsetHeight / 2 - mid);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best !== current) { current = best; updatePos(); }
  }, { passive: true });

  // ---- init ----
  if (!PAGES.length) {
    deck.innerHTML = '<div class="empty">未找到数据，请先运行 tools/build.py 生成 data/。</div>';
  } else {
    buildThemes();
    render();
  }
})();
