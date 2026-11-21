/*
 * «حلقة الذكر» (الإصدار ٧): شاشة قراءة هادئة للأذكار والآية وتفسيرها والفتاوى،
 * والساعة ومواقيت اليوم حاضرة دائماً في «شريط الوقت» (أسفل الشاشة أو أعلاها أو جانبها).
 *
 * الواجهة: ClockReader.show(view, dock)  حيث view = { kind, key, since, ... }  ثم ClockReader.hide()
 * المحتوى يُبنى «إطارات» (بطاقة + صفحة نص + مدة)، ويُحدَّد الإطار الحالي من الثواني المنقضية،
 * فتبقى الشاشة صحيحة حتى لو أُعيد تحميل الصفحة في منتصف الأذكار.
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var QR = window.ClockQuran;
  var S = null, cur = null, shownFrame = -1, visible = false, preview = false;
  var KINDS = {
    adhkar: "أذكار بعد الصلاة", ayah: "آية وتفسير", morning: "أذكار الصباح", evening: "أذكار المساء", fatwa: "فتوى"
  };
  var COUNT_WORDS = { 1: "", 2: "مرتان", 3: "ثلاث مرات", 4: "أربع مرات", 7: "سبع مرات", 10: "عشر مرات", 33: "٣٣ مرة", 100: "مئة مرة" };

  function build() {
    if ($("reader")) return;
    var el = document.createElement("div");
    el.id = "reader"; el.className = "reader"; el.hidden = true;
    el.innerHTML =
      '<div class="rd-glow" aria-hidden="true"></div>' +
      '<section class="rd-stage">' +
        '<div class="rd-head"><span class="rd-star" aria-hidden="true">' + star() + '</span><span class="rd-kind" id="rdKind"></span><span class="rd-sub" id="rdSub"></span></div>' +
        '<div class="rd-body" id="rdBody">' +
          '<div class="rd-card" id="rdCard">' + corners() +
            '<div class="rd-title" id="rdTitle"></div>' +
            '<div class="rd-basmala" id="rdBasmala" hidden></div>' +
            '<div class="rd-main" id="rdMain"></div>' +
            '<div class="rd-ref" id="rdRef"></div>' +
          '</div>' +
          '<div class="rd-panel" id="rdPanel" hidden><div class="rd-plabel" id="rdPLabel"></div><div class="rd-ptext" id="rdPText"></div><div class="rd-psrc" id="rdPSrc"></div></div>' +
        '</div>' +
        '<div class="rd-foot"><div class="rd-dots" id="rdDots"></div><div class="rd-prog"><i id="rdProg"></i></div></div>' +
      '</section>' +
      '<aside class="dock" id="dock">' +
        '<div class="dk-line" aria-hidden="true"><i id="dkFill"></i><span class="dk-orb" id="dkOrb"></span></div>' +
        '<div class="dk-clock"><div class="dk-time"><span class="num" id="dkHm"></span><span class="dk-sec num" id="dkSec"></span><span class="dk-ap" id="dkAp"></span></div><div class="dk-date" id="dkDate"></div></div>' +
        '<div class="dk-next"><span class="dk-nl" id="dkNL"></span><b id="dkNN"></b><span class="dk-left num" id="dkNLeft"></span></div>' +
        '<div class="dk-prayers" id="dkPrayers"></div>' +
      '</aside>';
    document.body.appendChild(el);
  }
  function star() {
    return '<svg viewBox="-50 -50 100 100"><path d="M0 -44L12.6 -30.4L31.1 -31.1L30.4 -12.6L44 0L30.4 12.6L31.1 31.1L12.6 30.4L0 44L-12.6 30.4L-31.1 31.1L-30.4 12.6L-44 0L-30.4 -12.6L-31.1 -31.1L-12.6 -30.4Z"/></svg>';
  }
  function corners() { // زخرفة الأركان: نجمة ثمانية وخطّا إطار
    var c = '<svg class="rd-corner" viewBox="0 0 60 60" aria-hidden="true"><path d="M4 56V18Q4 4 18 4H56"/><path d="M12 56V24Q12 12 24 12H56" class="thin"/><g transform="translate(20 20) scale(.16)"><path d="M0 -44L12.6 -30.4L31.1 -31.1L30.4 -12.6L44 0L30.4 12.6L31.1 31.1L12.6 30.4L0 44L-12.6 30.4L-31.1 31.1L-30.4 12.6L-44 0L-30.4 -12.6L-31.1 -31.1L-12.6 -30.4Z" class="st"/></g></svg>';
    return '<div class="rd-corners" aria-hidden="true">' + ["tr", "tl", "br", "bl"].map(function (k) { return '<i class="' + k + '">' + c + "</i>"; }).join("") + "</div>";
  }

  // ——— بناء الإطارات ———
  function adhkarList(kind, pkey) {
    var D = window.CLOCK_ADHKAR || {};
    var src = kind === "adhkar" ? (S.adhkarAfterList && S.adhkarAfterList.length ? S.adhkarAfterList : D.after)
      : kind === "morning" ? (S.adhkarMorningList && S.adhkarMorningList.length ? S.adhkarMorningList : D.morning)
      : (S.adhkarEveningList && S.adhkarEveningList.length ? S.adhkarEveningList : D.evening);
    var list = QR.parseAdhkar(src || []);
    return kind === "adhkar" ? QR.forPrayer(list, pkey || "dhuhr") : list.map(function (d) { d.count = d.n; return d; });
  }
  function countLabel(n) { return n > 1 ? (COUNT_WORDS[n] || QR.arNum(n) + " مرات") : ""; }

  function dhikrFrames(kind, pkey) {
    var out = [];
    adhkarList(kind, pkey).forEach(function (d) {
      var t = QR.dhikrText(d);
      if (!t) return; // آية والمصحف لم يُحمَّل بعد
      var dur = Math.max(14, Math.min(75, QR.readSeconds(t.text, S) + (d.count > 1 ? Math.min(20, d.count) : 0)));
      out.push({ card: { title: t.title, main: t.text, ref: d.src, quran: !!t.quran, basmala: !!t.basmala, count: countLabel(d.count) }, dur: dur });
    });
    return out;
  }

  var measure = { chars: 420 };
  function measurePanel() { // سعة صفحة التفسير بالحروف حسب حجم اللوحة الفعلي
    var p = $("rdPanel"), t = $("rdPText"), r = $("reader");
    var was = p.hidden, hadCls = r.classList.contains("has-panel");
    p.hidden = false; r.classList.add("has-panel");
    if ($("rdMain").textContent.length < 5) $("rdMain").textContent = "بسم الله الرحمن الرحيم\nالحمد لله رب العالمين"; // ارتفاع تقريبي للبطاقة
    var w = t.clientWidth, h = t.clientHeight, fs = parseFloat(getComputedStyle(t).fontSize) || 24;
    p.hidden = was; if (!hadCls) r.classList.remove("has-panel");
    if (w > 50 && h > 40) measure.chars = Math.max(140, Math.min(1400, Math.floor((w / (fs * .43)) * (h / (fs * 1.95)) * 1.08)));
    return measure.chars;
  }

  function ayahFrames(seed, advance) {
    var ps = QR.nextPassage(S, seed, advance);
    if (!ps) return [];
    var title = "سورة " + ps.name + " • " + (ps.a1 === ps.a2 ? "الآية " + QR.arNum(ps.a1) : "الآيات " + QR.arNum(ps.a1) + " – " + QR.arNum(ps.a2));
    var main = ps.verses.map(function (v) { return v.text + ' <span class="am">' + QR.ayahMark(v.n) + "</span>"; }).join(" ");
    var card = { title: title, main: main, html: true, quran: true, basmala: ps.a1 === 1 && ps.s !== 1 && ps.s !== 9,
      ref: ps.progress != null ? "الختمة " + QR.arNum(Math.max(1, Math.round(ps.progress * 100))) + "٪" : "", progress: ps.progress };
    var verseLen = ps.verses.reduce(function (a, v) { return a + v.text.length; }, 0);
    var frames = [];
    var taf = ps.tafsirs;
    if (S.tafsirRotate === "alternate" && taf.length > 1) taf = [taf[QR.hash(String(seed)) % taf.length]];
    if (!taf.length) frames.push({ card: card, dur: Math.max(25, Math.round(verseLen / 6)) });
    var cap = measurePanel();
    taf.forEach(function (t) {
      var pages = QR.paginate(t.text, cap);
      pages.forEach(function (pg, k) {
        frames.push({ card: card, panel: { label: t.name, text: pg, src: pages.length > 1 ? QR.arNum(k + 1) + " / " + QR.arNum(pages.length) : "" }, dur: QR.readSeconds(pg, S) + (frames.length ? 0 : Math.round(verseLen / 12)) });
      });
    });
    return frames;
  }

  function fatwaFrames(f) {
    var cap = measurePanel();
    var pages = QR.paginate(f.a, cap), out = [];
    var card = { title: f.title || "", main: f.q, ref: "", label: "السؤال", fatwa: true };
    pages.forEach(function (pg, k) {
      out.push({ card: card, panel: { label: "الجواب", text: pg, src: (k === pages.length - 1 && f.src ? f.src : "") + (pages.length > 1 ? (k === pages.length - 1 && f.src ? " • " : "") + QR.arNum(k + 1) + " / " + QR.arNum(pages.length) : "") }, dur: QR.readSeconds(pg, S) + (k ? 0 : QR.readSeconds(f.q, S) - 4) });
    });
    return out;
  }

  // جلسة: قائمة إطارات تمتد عند الحاجة (الآيات تتوالى، والأذكار تتكرر)
  function session(view) {
    var s = { key: view.key, kind: view.kind, frames: [], total: 0, n: 0, view: view };
    s.more = function () {
      var add = [];
      if (s.kind === "ayah") { if (!QR.ready() || !QR.tafsirsReady(S.tafsirs)) return false; add = ayahFrames(view.seed + "#" + s.n, !preview && view.advance !== false); }
      else if (s.kind === "fatwa") { if (s.n) return false; add = fatwaFrames(view.fatwa); }
      else { add = dhikrFrames(s.kind, view.p && view.p.key); if (!add.length) return false; }
      s.n++;
      add.forEach(function (f) { f.start = s.total; s.total += f.dur; s.frames.push(f); });
      return add.length > 0;
    };
    return s;
  }
  function frameAt(s, since) {
    var guard = 0;
    while (since >= s.total && guard++ < 50) { if (!s.more()) break; }
    if (!s.frames.length) return -1;
    if (since >= s.total) { // انتهت (الفتوى) أو تعذّر التمديد: كرّر من البداية
      since = since % s.total;
    }
    for (var i = s.frames.length - 1; i >= 0; i--) if (s.frames[i].start <= since) return i;
    return 0;
  }

  // ——— العرض ———
  function fit(el, maxPx, minPx) {
    el.style.fontSize = maxPx + "px";
    var size = maxPx, n = 0;
    while (n++ < 14 && size > minPx && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)) {
      size = Math.max(minPx, size * .9); el.style.fontSize = size + "px";
    }
  }
  function vh(x) { return innerHeight * x / 100; }
  function renderFrame(s, i) {
    var f = s.frames[i], c = f.card;
    $("reader").dataset.kind = s.kind;
    var cardKey = c.main + "|" + c.title;
    var main = $("rdMain");
    if (main.dataset.key !== cardKey) {
      main.dataset.key = cardKey;
      var t = $("rdTitle");
      t.innerHTML = (c.label ? '<span class="lbl">' + c.label + "</span>" : "") + (c.title ? '<span class="ttl">' + esc(c.title) + "</span>" : "") + (c.count ? '<span class="cnt">' + c.count + "</span>" : "");
      $("rdBasmala").hidden = !c.basmala;
      if (c.basmala) $("rdBasmala").textContent = QR.verse(1, 1);
      main.classList.toggle("quran", !!c.quran);
      main.classList.toggle("q-text", !!c.fatwa);
      if (c.html) main.innerHTML = c.main; else main.textContent = c.main;
      $("rdRef").textContent = c.ref || "";
      $("rdCard").classList.remove("in"); void $("rdCard").offsetWidth; $("rdCard").classList.add("in");
    }
    var p = $("rdPanel");
    p.hidden = !f.panel;
    $("reader").classList.toggle("has-panel", !!f.panel);
    if (f.panel) {
      $("rdPLabel").textContent = f.panel.label;
      $("rdPText").textContent = f.panel.text;
      $("rdPSrc").textContent = f.panel.src || "";
      p.classList.remove("in"); void p.offsetWidth; p.classList.add("in");
    }
    // تكبير النص حتى يملأ المكان المتاح دون أن يفيض
    var portrait = innerHeight > innerWidth, u = portrait ? innerWidth / 100 * 1.25 : innerHeight / 100;
    if (f.panel) {
      fit(main, (c.quran ? 6.2 : 4.6) * u, 2.1 * u);
      fit($("rdPText"), 3.7 * u, 1.9 * u);
    } else {
      fit(main, (c.quran ? 7.4 : 6.4) * u, 2.4 * u);
    }
    // نقاط الصفحات للمقطع الحالي
    var same = [], k;
    for (k = 0; k < s.frames.length; k++) if (s.frames[k].card === c) same.push(k);
    $("rdDots").innerHTML = same.length > 1 ? same.map(function (x) { return '<i class="' + (x === i ? "on" : "") + '"></i>'; }).join("") : "";
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }

  var dockKey = "";
  function renderDock(d) {
    if (!d) return;
    if ($("dkHm").textContent !== d.hm) $("dkHm").textContent = d.hm;
    $("dkSec").textContent = d.sec; $("dkAp").textContent = d.ap;
    if ($("dkDate").textContent !== d.date) $("dkDate").textContent = d.date;
    $("dkNL").textContent = d.nextLabel; $("dkNN").textContent = d.nextName; $("dkNLeft").textContent = d.nextLeft;
    var k = d.prayers.map(function (p) { return p.name + p.adhan + p.iq + p.cls; }).join("|");
    if (k !== dockKey) {
      dockKey = k;
      $("dkPrayers").innerHTML = d.prayers.map(function (p) {
        return '<div class="dk-p ' + p.cls + '"><span class="n">' + p.name + '</span><span class="a num">' + p.adhan + "</span>" + (p.iq ? '<span class="i num">' + p.iq + "</span>" : '<span class="i"></span>') + "</div>";
      }).join("");
    }
    $("dkFill").style.width = (d.day * 100).toFixed(2) + "%";
    $("dkOrb").style.right = (d.day * 100).toFixed(2) + "%";
    $("dkOrb").classList.toggle("moon", !!d.night);
  }

  function show(view, dock) {
    build();
    var r = $("reader");
    if (!visible) { r.hidden = false; visible = true; document.body.classList.add("reading"); r.classList.remove("enter"); void r.offsetWidth; r.classList.add("enter"); }
    r.dataset.dock = (S.dockPos === "top" || S.dockPos === "side") ? S.dockPos : "bottom";
    renderDock(dock);
    if (!cur || cur.key !== view.key) { cur = session(view); shownFrame = -1; $("rdMain").dataset.key = ""; }
    var i = frameAt(cur, view.since);
    $("rdKind").textContent = KINDS[view.kind] || "";
    $("rdSub").textContent = view.sub || "";
    if (i < 0) { $("rdMain").textContent = "…"; return; }
    if (i !== shownFrame) { shownFrame = i; renderFrame(cur, i); }
    var f = cur.frames[i], pos = view.since % Math.max(1, cur.total);
    var into = view.since >= cur.total ? pos - f.start : view.since - f.start;
    $("rdProg").style.width = Math.max(0, Math.min(100, 100 - into / f.dur * 100)).toFixed(1) + "%";
  }
  function hide() {
    if (!visible) return;
    $("reader").hidden = true; visible = false; document.body.classList.remove("reading");
    if (cur && cur.kind !== "ayah") cur = null; // الآية تبقى حتى لا يتقدم مؤشر الختمة مرتين إن عادت الجلسة نفسها
  }
  function fatwaDuration(f) { build(); var r = $("reader"), was = r.hidden; r.hidden = false; var fr = fatwaFrames(f); r.hidden = was; return fr.reduce(function (a, x) { return a + x.dur; }, 0); }

  window.ClockReader = {
    setSettings: function (s, opt) { S = s; preview = !!(opt && opt.preview); cur = null; shownFrame = -1; dockKey = ""; },
    show: show, hide: hide, fatwaDuration: fatwaDuration, visible: function () { return visible; }
  };
})();
