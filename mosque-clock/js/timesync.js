/*
 * تصحيح انحراف ساعة الجهاز.
 * عند تشغيل الساعة من خادم (server.js أو استضافة على الإنترنت) يُقارن وقت الجهاز بوقت الخادم
 * كل ساعة، ويُطبَّق الفرق إن زاد عن ثانية (ثانيتين ونصف مع ترويسة Date لأن دقتها ثانية).
 * الإصدار ١١: في تطبيق أندرويد يُقاس الانحراف بـ SNTP أصلي، وتظهر شارة إن زاد عن ثانية، وتُكشف قفزات ساعة الجهاز.
 */
(function () {
  var offset = 0, lastSync = null, source = "device";
  var KEY = "mosqueClock.clockOffset";
  try { offset = +localStorage.getItem(KEY) || 0; } catch (e) {}

  function measure(url, parse) {
    var t0 = Date.now();
    return fetch(url, { cache: "no-store", method: parse ? "GET" : "HEAD" }).then(function (r) {
      var t1 = Date.now();
      return Promise.resolve(parse ? r.json() : null).then(function (j) {
        var server = parse ? j.now : Date.parse(r.headers.get("date"));
        if (!server || isNaN(server)) throw new Error("no time");
        return { offset: server + (t1 - t0) / 2 - t1, rtt: t1 - t0 };
      });
    });
  }

  // الإصدار ١١: إبلاغ المراقبة الذاتية بأي فرق يزيد عن ثانية (ويُصحَّح العرض تلقائياً)
  var drift = null;
  function report(m) {
    drift = m;
    if (!window.ClockHealth) return;
    var abs = Math.abs(m.offset), secs = Math.round(abs / 100) / 10;
    if (abs < 1000) { ClockHealth.set("drift", ""); return; }
    var ar = function (x) { return String(x).replace(/[0-9]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩"[d]; }).replace(".", "٫"); };
    var amount = abs >= 120000 ? ar(Math.round(abs / 60000)) + " دقيقة" : ar(secs) + " ثانية";
    var txt = "ساعة الجهاز " + (m.offset > 0 ? "متأخرة " : "متقدمة ") + amount + (m.applied ? " • صُحّح العرض تلقائياً" : "");
    ClockHealth.set("drift", txt, abs >= 60000 ? "bad" : "warn");
    // الفرق الصغير المصحَّح لا يستحق شارة دائمة
    if (m.applied && abs < 60000) setTimeout(function () { if (drift === m) ClockHealth.set("drift", ""); }, 3 * 60000);
  }

  // تطبيق أندرويد: قياس SNTP أصلي (الصفحة فيه ملفات محلية بلا خادم)
  function androidSync() {
    var A = window.AndroidClock;
    if (!A || typeof A.timeSync !== "function") return false;
    var j = null; try { j = JSON.parse(A.timeSync() || "null"); } catch (e) {}
    if (!j || !j.at) { setTimeout(androidSync, 20000); return true; } // يُقاس الآن في الخلفية
    if (j.at === lastAndroidAt) return true;
    lastAndroidAt = j.at;
    var applied = Math.abs(j.offset) >= 1000 && j.rtt < 1500;
    offset = applied ? Math.round(j.offset) : 0;
    lastSync = Date.now(); source = "ntp:" + j.server;
    try { localStorage.setItem(KEY, String(offset)); } catch (e) {}
    report({ offset: j.offset, rtt: j.rtt, src: "ntp", applied: applied });
    return true;
  }
  var lastAndroidAt = 0;

  // قفزة مفاجئة في ساعة الجهاز (تعديل يدوي أو مزامنة الشبكة): نعيد القياس فوراً
  var base = Date.now() - (window.performance ? performance.now() : 0);
  setInterval(function () {
    if (!window.performance) return;
    var b = Date.now() - performance.now();
    if (Math.abs(b - base) > 2000) {
      var jump = b - base; base = b;
      if (window.ClockHealth) ClockHealth.set("jump", "تغيّرت ساعة الجهاز فجأة " + (jump > 0 ? "للأمام" : "للخلف") + " • أعيد التحقق من الوقت", "warn");
      setTimeout(function () { if (window.ClockHealth) ClockHealth.set("jump", ""); }, 120000);
      if (window.AndroidClock && AndroidClock.timeSyncNow) { try { AndroidClock.timeSyncNow(); } catch (e) {} setTimeout(androidSync, 8000); }
      else sync();
    }
  }, 5000);

  function sync() {
    if (androidSync()) return;
    if (!/^https?:$/.test(location.protocol) || !window.fetch) return;
    // أولاً: وقت دقيق بالملّي ثانية من server.js، وإلا ترويسة Date من أي خادم (دقة ثانية)
    measure("api/time", true).then(function (m) { m.src = "server"; return m; })
      .catch(function () { return measure(location.pathname + "?t=" + Date.now(), false).then(function (m) { m.src = "http-date"; return m; }); })
      .then(function (m) {
        // server.js بدقة الملّي ثانية: نصحّح ما زاد عن ثانية؛ ترويسة Date دقتها ثانية فنحتاج هامشاً أكبر
        var limit = m.src === "server" ? 1000 : 2500;
        offset = Math.abs(m.offset) > limit ? Math.round(m.offset) : 0;
        lastSync = Date.now(); source = m.src;
        try { localStorage.setItem(KEY, String(offset)); } catch (e) {}
        report({ offset: m.src === "server" || Math.abs(m.offset) > limit ? m.offset : 0, rtt: m.rtt, src: m.src, applied: !!offset });
      })
      .catch(function () {});
  }

  window.ClockSync = {
    now: function () { return Date.now() + offset; },
    info: function () { return { offset: offset, lastSync: lastSync, source: source, drift: drift }; },
    sync: sync
  };
  setTimeout(sync, 1500); // بعد تحميل المراقبة الذاتية لتظهر الشارة
  setInterval(sync, 3600 * 1000); // الإصدار ١١: كل ساعة بدل ست ساعات
})();
