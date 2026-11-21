/*
 * المصحف والتفاسير والأذكار (الإصدار ٧) — دوال صافية قدر الإمكان لتسهل تجربتها.
 *  - data/quran/quran.js   المصحف كاملاً بالرسم العثماني (يُحمَّل عند الحاجة فقط)
 *  - data/tafsir/<id>.js   كل تفسير في ملف مستقل، ولا يُحمَّل إلا ما اختاره المستخدم
 */
(function (root) {
  var TAFSIRS = [
    { id: "muyassar", name: "التفسير الميسر", by: "مجمع الملك فهد", size: "1.9 MB" },
    { id: "mukhtasar", name: "المختصر في التفسير", by: "مركز تفسير", size: "1.9 MB" },
    { id: "jalalayn", name: "تفسير الجلالين", by: "المحلي والسيوطي", size: "2.8 MB" },
    { id: "saadi", name: "تفسير السعدي", by: "عبد الرحمن السعدي", size: "5.8 MB" }
  ];
  // أسماء السور (لصفحة الإعدادات دون تحميل المصحف كاملاً)
  var SURAHS = ["الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس", "هود", "يوسف", "الرعد", "ابراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه", "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم", "لقمان", "السجدة", "الأحزاب", "سبإ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر", "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق", "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة", "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج", "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الانسان", "المرسلات", "النبإ", "النازعات", "عبس", "التكوير", "الإنفطار", "المطففين", "الإنشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد", "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات", "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر", "المسد", "الإخلاص", "الفلق", "الناس"];
  var AR = "٠١٢٣٤٥٦٧٨٩";
  function arNum(n) { return String(n).replace(/[0-9]/g, function (d) { return AR[d]; }); }
  function enNum(s) { return String(s).replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); }); }

  // ——— الفهرس ———
  var idx = null;
  function Q() { return root.CLOCK_QURAN || null; }
  function index() {
    var q = Q(); if (!q) return null;
    if (idx && idx.q === q) return idx;
    var off = [0];
    q.counts.forEach(function (c, i) { off.push(off[i] + c); });
    idx = { q: q, off: off, verses: q.text.split("\n") };
    return idx;
  }
  function gi(s, a) { var x = index(); return x.off[s - 1] + a - 1; } // رقم الآية في المصحف (من ٠)
  function locate(i) { // من رقم عام إلى سورة وآية
    var x = index(), s = 1;
    while (s < 114 && x.off[s] <= i) s++;
    return { s: s, a: i - x.off[s - 1] + 1 };
  }
  function verse(s, a) { var x = index(); return x ? x.verses[gi(s, a)] : ""; }
  function surahName(s) { var q = Q(); return q ? q.names[s - 1] : ""; }

  // ——— التحميل عند الحاجة (يعمل أيضاً عند فتح الساعة كملف محلي) ———
  var loading = {}, failed = {};
  function tafsirsReady(ids) { return (ids || []).every(function (id) { return tafsir(id) || failed[id] || !TAFSIRS.some(function (t) { return t.id === id; }); }); }
  function loadScript(src) {
    if (loading[src]) return loading[src];
    loading[src] = new Promise(function (res, rej) {
      if (typeof document === "undefined") return rej(new Error("no document"));
      var el = document.createElement("script");
      el.src = src; el.async = true;
      el.onload = function () { res(); };
      el.onerror = function () { delete loading[src]; rej(new Error(src)); };
      document.head.appendChild(el);
    });
    return loading[src];
  }
  function ensureQuran() { return Q() ? Promise.resolve() : loadScript("data/quran/quran.js"); }
  function tafsir(id) { return root.CLOCK_TAFSIR && root.CLOCK_TAFSIR[id]; }
  function ensureTafsirs(ids) {
    return Promise.all((ids || []).map(function (id) {
      if (tafsir(id) || !TAFSIRS.some(function (t) { return t.id === id; })) return Promise.resolve();
      return loadScript("data/tafsir/" + id + ".js").catch(function () { failed[id] = true; });
    }));
  }

  // ——— بناء المقطع: آية أو آيات متتالية تكتمل بها وحدة التفسير ———
  // بعض التفاسير تشرح آيات معاً، فتبقى الآيات التالية فارغة؛ نوسّع المقطع ليشملها.
  function passageAt(i, ids, opt) {
    opt = opt || {};
    var x = index(), maxAyat = opt.maxAyat || 6, minChars = opt.minChars || 90, maxChars = opt.maxChars || 700;
    var T = (ids || []).map(tafsir).filter(Boolean);
    var loc = locate(i), start = x.off[loc.s - 1], end = x.off[loc.s] - 1;
    function cont(k) { return T.some(function (t) { return t.t[k] === ""; }); }
    // الرجوع لبداية وحدة التفسير، بحدّ أقصى، ولا يُرجع قبل floor (مؤشر الختمة) حتى لا يتكرر مقطع
    var floor = opt.floor != null ? Math.max(start, opt.floor) : start, back = 0;
    while (i > floor && cont(i) && back++ < maxAyat - 1) i--;
    var j = i, chars = x.verses[i].length;
    function grow() { j++; chars += x.verses[j].length; }
    while (j < end && j - i + 1 < maxAyat && cont(j + 1)) grow();
    while (j < end && j - i + 1 < maxAyat && chars < minChars && chars + x.verses[j + 1].length <= maxChars) {
      grow();
      while (j < end && j - i + 1 < maxAyat && cont(j + 1)) grow();
    }
    var a = locate(i), b = locate(j);
    return {
      i: i, j: j, s: a.s, a1: a.a, a2: b.a, name: surahName(a.s),
      verses: x.verses.slice(i, j + 1).map(function (t, k) { return { n: a.a + k, text: t }; }),
      tafsirs: T.map(function (t, k) {
        var parts = [];
        if (!t.t[i]) { // المقطع يبدأ داخل وحدة شرحٍ سابقة: نعرض شرحها لأنه يشمل هذه الآيات
          for (var b = i - 1; b >= start; b--) if (t.t[b]) { parts.push(t.t[b]); break; }
        }
        for (var n = i; n <= j; n++) if (t.t[n]) parts.push(t.t[n]);
        return { id: ids.filter(function (id) { return tafsir(id); })[k], name: t.name, by: t.by, text: parts.join("\n") };
      }).filter(function (t) { return t.text; })
    };
  }

  // نطاق العرض: كل المصحف أو من سورة إلى سورة
  function scope(S) {
    var x = index(), a = Math.max(1, Math.min(114, +S.ayahFrom || 1)), b = Math.max(a, Math.min(114, +S.ayahTo || 114));
    return { from: x.off[a - 1], to: x.off[b] - 1 };
  }
  // اختيار ثابت شبه عشوائي (يتكرر نفسه على كل الشاشات لنفس اليوم والصلاة)
  function hash(str) { var h = 2166136261; for (var k = 0; k < str.length; k++) { h ^= str.charCodeAt(k); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ——— الختمة المتتابعة: مؤشر محفوظ في الجهاز ———
  var KEY = "mosqueClock.khatma.v1";
  function readPtr() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function writePtr(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  function khatma() { return readPtr() || { i: -1, done: 0, rounds: 0 }; }

  // المقطع التالي حسب الإعدادات. seed للمقطع العشوائي، وadvance لتحريك مؤشر الختمة.
  function nextPassage(S, seed, advance) {
    if (!index()) return null;
    var sc = scope(S), ids = S.tafsirs || [], i;
    if (S.ayahMode === "random") {
      i = sc.from + hash(String(seed)) % (sc.to - sc.from + 1);
    } else {
      var p = khatma(), start = S.khatmaStart ? parseRef(S.khatmaStart) : null;
      if (p.i < 0 || p.i < sc.from || p.i > sc.to || (start != null && p.key !== S.khatmaStart)) {
        p = { i: start != null && start >= sc.from && start <= sc.to ? start : sc.from, done: 0, rounds: p.rounds || 0, key: S.khatmaStart || "" };
      }
      i = p.i;
      var ps = passageAt(i, ids, { maxAyat: S.maxAyat, floor: i });
      if (advance !== false) {
        var nx = ps.j + 1;
        if (nx > sc.to) { nx = sc.from; p.rounds = (p.rounds || 0) + 1; }
        writePtr({ i: nx, done: (p.done || 0) + ps.verses.length, rounds: p.rounds || 0, key: p.key || "" });
      }
      ps.progress = (ps.j - sc.from + 1) / (sc.to - sc.from + 1);
      return ps;
    }
    var out = passageAt(i, ids, { maxAyat: S.maxAyat });
    out.progress = null;
    return out;
  }
  function parseRef(ref) { // "2:255" ← رقم عام
    var m = /^\s*(\d{1,3})\s*[:：]\s*(\d{1,3})\s*$/.exec(enNum(ref || ""));
    if (!m || !index()) return null;
    var s = +m[1], a = +m[2];
    if (s < 1 || s > 114 || a < 1 || a > index().q.counts[s - 1]) return null;
    return gi(s, a);
  }

  // ——— تقسيم النص الطويل على صفحات عند حدود الجمل ———
  function paginate(text, maxChars) {
    text = String(text || "").trim();
    maxChars = Math.max(120, maxChars || 420);
    if (text.length <= maxChars * 1.15) return [text];
    // (بلا lookbehind ليعمل على متصفحات أجهزة التلفاز القديمة)
    var raw = text.split(/([.؟!؛:\n،])\s+/), pieces = [], pages = [], cur = "";
    for (var r = 0; r < raw.length; r += 2) pieces.push(raw[r] + (raw[r + 1] && raw[r + 1] !== "\n" ? raw[r + 1] : ""));
    pieces.forEach(function (p) {
      while (p.length > maxChars) { // جملة طويلة جداً: تُقطع عند أقرب مسافة
        var cut = p.lastIndexOf(" ", maxChars); if (cut < maxChars * .5) cut = maxChars;
        if (cur) { pages.push(cur); cur = ""; }
        pages.push(p.slice(0, cut)); p = p.slice(cut).trim();
      }
      if (cur && (cur + " " + p).length > maxChars) { pages.push(cur); cur = p; }
      else cur = cur ? cur + (/\n$/.test(cur) ? "" : " ") + p : p;
    });
    if (cur) {
      if (pages.length && cur.length < maxChars * .25) pages[pages.length - 1] += " " + cur; else pages.push(cur);
    }
    return pages.map(function (p) { return p.trim(); }).filter(Boolean);
  }
  // مدة قراءة صفحة بالثواني
  function readSeconds(text, S) {
    var cps = Math.max(5, +((S && S.readSpeed) || 14));
    return Math.max(10, Math.min(90, Math.round(String(text).length / cps) + 4));
  }

  // ——— قوائم الأذكار بصيغة السطر الواحد ———
  var PR = { "الفجر": "fajr", "الظهر": "dhuhr", "الجمعة": "jumuah", "العصر": "asr", "المغرب": "maghrib", "العشاء": "isha" };
  function parseAdhkar(lines) {
    return (lines || []).map(function (line) {
      var f = String(line).split("|").map(function (x) { return x.trim(); });
      if (!f[0]) return null;
      var cnt = enNum(f[1] || "").split(/[\/،,]/).map(function (x) { return parseInt(x, 10) || 1; });
      var only = null;
      if (f[3]) { only = []; f[3].split(/[،,\s]+/).forEach(function (w) { if (PR[w]) only.push(PR[w]); if (PR[w] === "dhuhr") only.push("jumuah"); }); if (!only.length) only = null; }
      var q = /^@\s*(\d{1,3})(?:\s*:\s*(\d{1,3}))?$/.exec(enNum(f[0]));
      return { text: q ? "" : f[0], q: q ? { s: +q[1], a: q[2] ? +q[2] : 0 } : null, n: cnt[0] || 1, nFM: cnt[1] || cnt[0] || 1, src: f[2] || "", only: only };
    }).filter(Boolean);
  }
  // يحوّل الذكر إلى نص معروض (الآيات من المصحف). يعيد null إن احتاج المصحف ولم يُحمَّل بعد.
  function dhikrText(d) {
    if (!d.q) return { text: d.text, title: "" };
    if (!index()) return null;
    var s = d.q.s;
    if (s < 1 || s > 114) return null;
    if (d.q.a) return { text: verse(s, d.q.a) + " " + ayahMark(d.q.a), title: "سورة " + surahName(s) + " • " + arNum(d.q.a), quran: true };
    var n = index().q.counts[s - 1], parts = [];
    for (var a = 1; a <= n; a++) parts.push(verse(s, a) + " " + ayahMark(a));
    return { text: parts.join(" "), title: "سورة " + surahName(s), quran: true, basmala: s !== 9 && s !== 1 };
  }
  function ayahMark(n) { return "۝" + arNum(n); }
  function forPrayer(list, key) {
    var fm = key === "fajr" || key === "maghrib";
    return list.filter(function (d) { return !d.only || d.only.indexOf(key) >= 0; })
      .map(function (d) { var o = {}; for (var k in d) o[k] = d[k]; o.count = fm ? d.nFM : d.n; return o; });
  }

  root.ClockQuran = {
    TAFSIRS: TAFSIRS, SURAHS: SURAHS, ensureQuran: ensureQuran, ensureTafsirs: ensureTafsirs, ready: function () { return !!index(); }, tafsirsReady: tafsirsReady,
    tafsir: tafsir, verse: verse, surahName: surahName, gi: gi, locate: locate, passageAt: passageAt, nextPassage: nextPassage,
    parseRef: parseRef, paginate: paginate, readSeconds: readSeconds, parseAdhkar: parseAdhkar, dhikrText: dhikrText,
    forPrayer: forPrayer, ayahMark: ayahMark, arNum: arNum, khatma: khatma, resetKhatma: function () { try { localStorage.removeItem(KEY); } catch (e) {} },
    KEY: KEY, hash: hash
  };
  if (typeof module !== "undefined") module.exports = root.ClockQuran;
})(typeof window !== "undefined" ? window : globalThis);
