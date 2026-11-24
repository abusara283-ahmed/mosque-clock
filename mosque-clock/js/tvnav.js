/*
 * الإصدار ١١٫١: التنقل بالريموت في صفحات النماذج (الإعدادات والإعلانات…) لكل أنواع الريموت.
 *
 * ١) تنقل مكاني: الأسهم تنقل التحديد إلى أقرب عنصر في اتجاهها على الشاشة.
 *    - أعلى/أسفل ينقلان التحديد دائماً، حتى من المنزلقة والقائمة المنسدلة وحقل الرقم.
 *    - المنزلقة: يمين/يسار يغيّران القيمة في «وضع التعديل» فقط؛ «موافق» يدخله ويخرج منه، والرجوع يخرج منه.
 *      خارج وضع التعديل يمين/يسار ينقلان التحديد كأي عنصر.
 *    - إطار تحديد واضح يُرى من بعيد، وتمرير تلقائي يُبقي العنصر المحدد وسط الشاشة.
 * ٢) وضع الفأرة: الأسهم تحرّك مؤشراً (يتسارع كلما طال الضغط) و«موافق» نقرة.
 *    يُفعَّل بالضغط المطوّل على «موافق» أو بزر القائمة أو من زر 🖱 في الصفحة، ويُلغى بالرجوع.
 *    المؤشر يختفي بعد ثوانٍ من عدم الحركة، ويُرسم داخل الصفحة فيعمل مع أي ريموت.
 * الواجهة: window.TvNav { next(el, dir), move(dir), cursor(on), isCursor(), back(), focusables() }
 */
(function () {
  if (window.TvNav) return;
  var CUR_KEY = "mosqueClock.cursor";
  var SPATIAL = !document.documentElement.hasAttribute("data-no-spatial");
  var doc = document, root = doc.documentElement;

  // ——— العناصر القابلة للتحديد ———
  var SEL = "a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
  function shown(el) {
    if (!el.getClientRects().length) return false;
    var cs = getComputedStyle(el);
    if (cs.visibility === "hidden") return false;
    // مربعات الاختيار المخفية بصرياً داخل ملصق ظاهر تبقى قابلة للتحديد
    return !el.closest("[hidden]") && !el.closest("[inert]");
  }
  function focusables(scope) {
    return [].slice.call((scope || doc).querySelectorAll(SEL)).filter(function (el) {
      if (el.tagName === "IFRAME") return false;
      return shown(el);
    });
  }
  function rect(el) {
    var r = el.getBoundingClientRect();
    // عنصر بلا مساحة (مربع اختيار مخفي): نأخذ مستطيل ملصقه
    if ((r.width < 2 || r.height < 2) && el.closest("label")) r = el.closest("label").getBoundingClientRect();
    return r;
  }

  // أقرب عنصر في الاتجاه: المسافة على المحور الرئيسي + ضعفا الانحراف الجانبي (مع تفضيل المتداخلين جانبياً)
  function next(from, dir, list) {
    list = list || focusables();
    var a = from ? rect(from) : { top: -1, bottom: -1, left: 0, right: innerWidth, width: innerWidth, height: 0 };
    var best = null, bestScore = Infinity;
    list.forEach(function (el) {
      if (el === from) return;
      var b = rect(el), main, lat;
      if (dir === "down" || dir === "up") {
        main = dir === "down" ? b.top - a.bottom : a.top - b.bottom;
        var cy = dir === "down" ? (b.top + b.bottom) / 2 - (a.top + a.bottom) / 2 : (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2;
        if (cy <= 2 || main < -Math.min(a.height, b.height) / 2) return;
        lat = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
        main = Math.max(0, main);
      } else {
        main = dir === "right" ? b.left - a.right : a.left - b.right;
        var cx = dir === "right" ? (b.left + b.right) / 2 - (a.left + a.right) / 2 : (a.left + a.right) / 2 - (b.left + b.right) / 2;
        if (cx <= 2 || main < -Math.min(a.width, b.width) / 2) return;
        lat = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));
        if (lat > Math.max(a.height, b.height) * 1.5) return; // يمين/يسار في الصف نفسه تقريباً
        main = Math.max(0, main);
      }
      var score = main + lat * 2 + (lat > 0 ? 40 : 0);
      if (score < bestScore) { bestScore = score; best = el; }
    });
    return best;
  }

  function reveal(el) {
    var r = el.getBoundingClientRect(), top = 90, bottom = innerHeight - 60;
    var head = doc.querySelector("header"), tabs = doc.getElementById("tabs");
    if (head && getComputedStyle(head).position === "sticky") top = Math.max(top, head.getBoundingClientRect().bottom + 16);
    if (tabs && getComputedStyle(tabs).position === "sticky") top = Math.max(top, tabs.getBoundingClientRect().bottom + 16);
    if (r.top < top || r.bottom > bottom) scrollBy(0, (r.top + r.bottom) / 2 - (top + bottom) / 2);
  }

  var editing = null;
  function setEditing(el) {
    if (editing && editing !== el) editing.classList.remove("tv-edit");
    editing = el;
    if (el) el.classList.add("tv-edit");
    hint(el ? "◀ ▶ لتغيير القيمة • موافق أو رجوع للإنهاء" : "", el);
  }
  var hintEl = null;
  function hint(text, near) {
    if (!hintEl) { hintEl = doc.createElement("div"); hintEl.className = "tv-hint"; hintEl.setAttribute("aria-live", "polite"); doc.body.appendChild(hintEl); }
    hintEl.textContent = text; hintEl.hidden = !text;
    if (text && near) { var r = near.getBoundingClientRect(); hintEl.style.top = Math.max(8, r.top - 40) + "px"; hintEl.style.left = Math.max(8, Math.min(innerWidth - 340, r.left)) + "px"; }
  }

  function go(el) {
    if (!el) return false;
    setEditing(null);
    el.focus({ preventScroll: true });
    reveal(el);
    if (typeof window.TvNavOnMove === "function") window.TvNavOnMove(el);
    return true;
  }
  function move(dir) {
    var cur = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
    var n = next(cur, dir);
    if (n) return go(n);
    // لا عنصر في هذا الاتجاه: تمرير الصفحة لإظهار ما بعدها
    if (dir === "down" || dir === "up") scrollBy(0, (dir === "down" ? 1 : -1) * innerHeight * 0.4);
    return false;
  }

  function typeOf(el) {
    if (!el) return "";
    var t = el.tagName;
    if (t === "INPUT") return (el.type || "text").toLowerCase();
    return t.toLowerCase();
  }
  var TEXTY = { text: 1, search: 1, email: 1, url: 1, tel: 1, password: 1, number: 1, date: 1, time: 1, "datetime-local": 1, month: 1, week: 1, textarea: 1 };

  // ——— وضع الفأرة ———
  var cursorOn = false, cx = innerWidth / 2, cy = innerHeight / 2, curEl = null, hideT = 0, held = {}, holdStart = 0, raf = 0, hoverEl = null;
  function cursorNode() {
    if (curEl) return curEl;
    curEl = doc.createElement("div"); curEl.className = "tv-cursor"; curEl.setAttribute("aria-hidden", "true");
    curEl.innerHTML = '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M3 2l16 9.5-7 1.6 4.2 7.4-3 1.6-4.1-7.4L3 19z" fill="#fff" stroke="#0a0f1c" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    doc.body.appendChild(curEl);
    return curEl;
  }
  function place() {
    var c = cursorNode();
    c.style.transform = "translate(" + cx + "px," + cy + "px)";
    c.classList.remove("idle");
    clearTimeout(hideT); hideT = setTimeout(function () { c.classList.add("idle"); }, 4000);
    var under = doc.elementFromPoint(cx, cy), t = under && under.closest(SEL + ", label");
    if (t !== hoverEl) { if (hoverEl) hoverEl.classList.remove("tv-hover"); hoverEl = t; if (t) t.classList.add("tv-hover"); }
  }
  function setCursor(on, quiet) {
    cursorOn = !!on;
    try { localStorage.setItem(CUR_KEY, cursorOn ? "1" : "0"); } catch (e) {}
    root.classList.toggle("tv-cursor-on", cursorOn);
    setEditing(null);
    if (cursorOn) {
      var a = doc.activeElement;
      if (a && a !== doc.body) { var r = a.getBoundingClientRect(); cx = r.left + Math.min(r.width / 2, 40); cy = r.top + r.height / 2; }
      cx = Math.max(4, Math.min(innerWidth - 4, cx)); cy = Math.max(4, Math.min(innerHeight - 4, cy));
      place();
    } else {
      if (curEl) curEl.classList.add("idle");
      if (hoverEl) { hoverEl.classList.remove("tv-hover"); hoverEl = null; }
    }
    if (!quiet) toast(cursorOn ? "وضع الفأرة: الأسهم تحرّك المؤشر و«موافق» للنقر • الرجوع للخروج" : "وضع التنقل: الأسهم تنتقل بين العناصر");
    var btn = doc.getElementById("tvCursorBtn"); if (btn) btn.setAttribute("aria-pressed", cursorOn ? "true" : "false");
  }
  function frame() {
    raf = 0;
    var dx = (held.right ? 1 : 0) - (held.left ? 1 : 0), dy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    if (!dx && !dy) return;
    // تسارع تدريجي: يبدأ بطيئاً للدقة ثم يسرع كلما طال الضغط
    var t = Date.now() - holdStart, v = Math.min(34, 3 + t / 45);
    cx = Math.max(2, Math.min(innerWidth - 2, cx + dx * v));
    cy += dy * v;
    // عند الحافة: تمرير الصفحة
    if (cy > innerHeight - 30) { scrollBy(0, cy - (innerHeight - 30)); cy = innerHeight - 30; }
    if (cy < 30) { scrollBy(0, cy - 30); cy = 30; }
    place();
    raf = requestAnimationFrame(frame);
  }
  function step(dir) { // ضغطة واحدة دون استمرار (لبعض الريموتات التي لا ترسل keyup) تحرّك خطوة
    var d = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
    cx = Math.max(2, Math.min(innerWidth - 2, cx + d[0] * 14)); cy = Math.max(2, Math.min(innerHeight - 2, cy + d[1] * 14)); place();
  }
  function clickAt() {
    var el = doc.elementFromPoint(cx, cy);
    if (!el) return;
    var t = el.closest("input, select, textarea, button, a[href], label, [tabindex]") || el;
    if (t.tagName === "INPUT" && t.type === "range") {
      var r = t.getBoundingClientRect(), rtl = getComputedStyle(t).direction === "rtl";
      var f = Math.max(0, Math.min(1, (cx - r.left) / r.width)); if (rtl) f = 1 - f;
      var min = +t.min || 0, max = t.max === "" ? 100 : +t.max, stp = +t.step || 1;
      t.value = Math.round((min + f * (max - min)) / stp) * stp;
      t.focus({ preventScroll: true });
      t.dispatchEvent(new Event("input", { bubbles: true })); t.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (t.tagName === "SELECT") { t.focus({ preventScroll: true }); try { if (t.showPicker) { t.showPicker(); return; } } catch (e) {} t.click(); return; }
    if (t.focus) t.focus({ preventScroll: true });
    var o = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: window };
    ["pointerdown", "mousedown", "pointerup", "mouseup"].forEach(function (n) { try { el.dispatchEvent(new (n.indexOf("pointer") === 0 && window.PointerEvent ? PointerEvent : MouseEvent)(n, o)); } catch (e) {} });
    el.click ? el.click() : el.dispatchEvent(new MouseEvent("click", o));
  }

  // ——— رسالة صغيرة ———
  var toastEl = null, toastT = 0;
  function toast(m) {
    if (!toastEl) { toastEl = doc.createElement("div"); toastEl.className = "tv-toast"; doc.body.appendChild(toastEl); }
    toastEl.textContent = m; toastEl.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 3200);
  }

  // ——— لوحة المفاتيح والريموت ———
  var DIR = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Up: "up", Down: "down", Left: "left", Right: "right" };
  var okDown = 0, okTarget = null, okLong = false, okTimer = 0;
  function isOk(e) { return e.key === "Enter" || e.key === " " && !TEXTY[typeOf(doc.activeElement)] || e.keyCode === 23; }
  function isBack(e) { return e.key === "Escape" || e.key === "GoBack" || e.key === "BrowserBack" || e.keyCode === 4; }

  addEventListener("keydown", function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    var dir = DIR[e.key], a = doc.activeElement, ty = typeOf(a);
    if (dir || isOk(e)) root.classList.add("kbnav");

    if (cursorOn) {
      if (dir) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (!held[dir]) { if (!Object.keys(held).some(function (k) { return held[k]; })) holdStart = Date.now(); held[dir] = true; step(dir); }
        if (!raf) raf = requestAnimationFrame(frame);
        return;
      }
      if (isOk(e)) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (!e.repeat) { okDown = Date.now(); okLong = false; clearTimeout(okTimer); okTimer = setTimeout(function () { okLong = true; setCursor(false); }, 900); }
        return;
      }
      if (isBack(e)) { e.preventDefault(); e.stopImmediatePropagation(); setCursor(false); return; }
      if (e.key === "ContextMenu") { e.preventDefault(); setCursor(false); return; }
      return;
    }

    if (e.key === "ContextMenu") { e.preventDefault(); setCursor(true); return; }
    if (!SPATIAL) {
      // صفحة الساعة: لا تنقل مكاني (لها أزرارها)، فقط الضغط المطوّل على «موافق» لوضع الفأرة
      if (isOk(e) && !e.repeat) { okDown = Date.now(); clearTimeout(okTimer); okTimer = setTimeout(function () { okLong = true; setCursor(true); }, 900); okLong = false; }
      return;
    }

    if (isBack(e) && editing) { e.preventDefault(); setEditing(null); return; }

    if (dir) {
      var vertical = dir === "up" || dir === "down";
      // المنزلقة في وضع التعديل: يمين/يسار للقيمة (السلوك الأصلي)
      if (ty === "range" && editing === a && !vertical) return;
      // النصوص: يمين/يسار تحرّك المؤشر داخل النص ما دام فيه حروف
      if (TEXTY[ty] && ty !== "number" && !vertical && a.value && a.selectionStart != null) {
        var atStart = a.selectionStart === 0 && a.selectionEnd === 0, atEnd = a.selectionStart === a.value.length;
        var rtl = getComputedStyle(a).direction === "rtl";
        var towardStart = rtl ? dir === "right" : dir === "left";
        if (!(towardStart ? atStart : atEnd)) return;
      }
      if (ty === "textarea" && vertical && editing === a) return;
      e.preventDefault(); e.stopImmediatePropagation();
      move(dir);
      return;
    }

    if (isOk(e)) {
      if (ty === "select" || (TEXTY[ty] && ty !== "textarea") || (ty === "textarea" && editing !== a)) {
        if (ty === "textarea") { setEditing(a); }
        // القائمة المنسدلة والنص: السلوك الأصلي (يفتح الاختيار أو لوحة المفاتيح)، مع دعم الضغط المطوّل
        if (!e.repeat) { okDown = Date.now(); okLong = false; clearTimeout(okTimer); okTimer = setTimeout(function () { okLong = true; setCursor(true); }, 900); }
        if (ty === "select" && e.key === "Enter") { e.preventDefault(); try { if (a.showPicker) a.showPicker(); else a.click(); } catch (x) { a.click(); } }
        return;
      }
      if (ty === "textarea") return; // سطر جديد داخل وضع التعديل
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat) { okDown = Date.now(); okLong = false; okTarget = a; clearTimeout(okTimer); okTimer = setTimeout(function () { okLong = true; setCursor(true); }, 900); }
    }
  }, true);

  addEventListener("keyup", function (e) {
    var dir = DIR[e.key];
    if (cursorOn && dir) { held[dir] = false; e.preventDefault(); return; }
    if (!isOk(e)) return;
    clearTimeout(okTimer);
    if (okLong) { okLong = false; okTarget = null; e.preventDefault(); return; }
    if (cursorOn) { if (okDown) { e.preventDefault(); clickAt(); } okDown = 0; return; }
    if (!SPATIAL || !okTarget) { okTarget = null; return; }
    var a = okTarget; okTarget = null; okDown = 0;
    if (a !== doc.activeElement) return;
    e.preventDefault();
    var ty = typeOf(a);
    if (ty === "range") { setEditing(editing === a ? null : a); return; }
    a.click();
  }, true);

  // النقر باللمس أو الفأرة الحقيقية يُنهي وضع التعديل
  addEventListener("pointerdown", function (e) { if (e.isTrusted) { root.classList.remove("kbnav"); setEditing(null); } }, true);
  addEventListener("blur", function () { held = {}; }, true);

  // ——— الأنماط ———
  var css = doc.createElement("style");
  css.textContent =
    "html.kbnav :focus, html.tv :focus { outline: 4px solid #d9b562 !important; outline-offset: 3px; box-shadow: 0 0 0 9px rgba(217,181,98,.3) !important; border-radius: 6px; }" +
    "html.kbnav label:has(> input[type=checkbox]:focus), html.kbnav label:has(> input[type=radio]:focus) { outline: 3px dashed #d9b562; outline-offset: 4px; border-radius: 6px; }" +
    ".tv-edit { outline-color: #2fbf8f !important; box-shadow: 0 0 0 9px rgba(47,191,143,.35) !important; }" +
    ".tv-hint { position: fixed; z-index: 2147483000; background: #0a2e24; color: #fff; font: 700 15px Tahoma, sans-serif; padding: 7px 14px; border-radius: 10px; box-shadow: 0 6px 18px rgba(0,0,0,.35); pointer-events: none; }" +
    ".tv-hint[hidden] { display: none; }" +
    ".tv-cursor { position: fixed; z-index: 2147483001; top: 0; left: 0; width: 34px; height: 34px; margin: -3px 0 0 -3px; pointer-events: none; transition: opacity .6s; filter: drop-shadow(0 2px 4px rgba(0,0,0,.5)); }" +
    ".tv-cursor.idle, html:not(.tv-cursor-on) .tv-cursor { opacity: 0; }" +
    "html.tv-cursor-on .tv-hover { outline: 3px solid rgba(217,181,98,.9) !important; outline-offset: 2px; }" +
    ".tv-toast { position: fixed; z-index: 2147483002; left: 50%; bottom: 24px; transform: translateX(-50%) translateY(20px); opacity: 0; background: #12392f; color: #fff; font: 700 16px Tahoma, sans-serif;" +
    " padding: 12px 20px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.35); transition: .3s; pointer-events: none; max-width: 90vw; text-align: center; }" +
    ".tv-toast.show { opacity: 1; transform: translateX(-50%); }";
  (doc.head || root).appendChild(css);

  function start() {
    var saved = null; try { saved = localStorage.getItem(CUR_KEY); } catch (e) {}
    if (saved === "1") setCursor(true, true);
    var btn = doc.getElementById("tvCursorBtn");
    if (btn) btn.addEventListener("click", function () { setCursor(!cursorOn); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();

  window.TvNav = {
    next: next, move: move, focusables: focusables, go: go,
    cursor: function (on) { setCursor(on === undefined ? !cursorOn : on); return cursorOn; },
    isCursor: function () { return cursorOn; },
    editing: function () { return editing; },
    cursorPos: function () { return { x: cx, y: cy }; },
    // الرجوع في التطبيق: يخرج من وضع الفأرة أو التعديل أولاً
    back: function () { if (cursorOn) { setCursor(false); return true; } if (editing) { setEditing(null); return true; } return false; }
  };
})();
