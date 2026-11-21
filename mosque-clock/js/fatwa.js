/*
 * الفتاوى (الإصدار ٧): تُقرأ من ملف نصي بسيط (انظر data/fatwas-template.txt).
 *   س: نص السؤال
 *   ج: نص الجواب (يمكن أن يمتد عدة أسطر)
 *   المصدر: اسم المفتي أو الجهة (اختياري)
 *   ---
 * المصادر بالترتيب: ما رُفع من صفحة الإعدادات (يُحفظ مع الإعدادات ويصل للشاشة من الجوال)،
 * ثم ملف data/fatwas.txt عند التشغيل من خادم، ثم data/fatwas.js (يعمل كملف محلي).
 */
(function (root) {
  var Q_RE = /^\s*(?:س|سؤال|السؤال|Q)\s*[:：\-–]\s*/i;
  var A_RE = /^\s*(?:ج|جواب|الجواب|A)\s*[:：\-–]\s*/i;
  var S_RE = /^\s*(?:المصدر|المفتي|المرجع|source)\s*[:：\-–]\s*/i;
  var T_RE = /^\s*(?:العنوان|الموضوع|title)\s*[:：\-–]\s*/i;

  function parse(text) {
    var out = [], cur = null, field = null, errors = [];
    function flush() {
      if (cur && cur.q && cur.a) out.push({ q: cur.q.trim(), a: cur.a.trim(), src: (cur.src || "").trim(), title: (cur.title || "").trim() });
      else if (cur && (cur.q || cur.a)) errors.push(cur.line);
      cur = null; field = null;
    }
    String(text || "").replace(/^﻿/, "").split(/\r?\n/).forEach(function (line, n) {
      if (/^\s*#/.test(line)) return;               // تعليق
      if (/^\s*(-{3,}|_{3,}|={3,}|\*{3,})\s*$/.test(line)) { flush(); return; } // فاصل
      var m;
      if (Q_RE.test(line)) { if (cur && cur.a) flush(); cur = cur || { line: n + 1 }; cur.q = line.replace(Q_RE, ""); field = "q"; return; }
      if (A_RE.test(line)) { cur = cur || { line: n + 1 }; cur.a = line.replace(A_RE, ""); field = "a"; return; }
      if (S_RE.test(line) && cur) { cur.src = line.replace(S_RE, ""); field = "src"; return; }
      if (T_RE.test(line)) { if (cur && cur.a) flush(); cur = cur || { line: n + 1 }; cur.title = line.replace(T_RE, ""); field = "title"; return; }
      if (!line.trim()) { if (field === "a") cur.a += "\n"; return; }
      if (cur && field) cur[field] += (cur[field] && !/\n$/.test(cur[field]) ? " " : "") + line.trim();
    });
    flush();
    out.forEach(function (f) { f.a = f.a.replace(/\n{2,}/g, "\n").trim(); });
    return { list: out, errors: errors };
  }

  var fileList = null;
  function loadFile() {
    if (typeof location === "undefined" || !/^https?:$/.test(location.protocol) || !root.fetch) return;
    fetch("data/fatwas.txt", { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.text(); })
      .then(function (t) { var p = parse(t); if (p.list.length) fileList = p.list; }).catch(function () {});
  }
  function list(S) {
    if (S && S.fatwas && S.fatwas.length) return S.fatwas;
    if (fileList) return fileList;
    if (root.CLOCK_FATWAS_TEXT) { var p = parse(root.CLOCK_FATWAS_TEXT); if (p.list.length) return p.list; }
    return [];
  }

  // التالية بالترتيب (مؤشر محفوظ في الجهاز)
  var KEY = "mosqueClock.fatwaIdx.v1";
  function next(S) {
    var l = list(S); if (!l.length) return null;
    var i = 0; try { i = +(localStorage.getItem(KEY) || 0); } catch (e) {}
    var f = l[i % l.length];
    try { localStorage.setItem(KEY, String((i + 1) % l.length)); } catch (e) {}
    return { f: f, i: i % l.length, n: l.length };
  }

  root.ClockFatwa = { parse: parse, list: list, next: next, loadFile: loadFile };
  if (typeof document !== "undefined") loadFile();
  if (typeof module !== "undefined") module.exports = root.ClockFatwa;
})(typeof window !== "undefined" ? window : globalThis);
