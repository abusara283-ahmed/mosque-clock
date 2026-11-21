/*
 * تصحيح انحراف ساعة الجهاز.
 * عند تشغيل الساعة من خادم (server.js أو استضافة على الإنترنت) يُقارن وقت الجهاز بوقت الخادم
 * كل ٦ ساعات، ويُطبَّق الفرق إن زاد عن ثانيتين. عند الفتح كملف محلي يُعتمد وقت الجهاز.
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

  function sync() {
    if (!/^https?:$/.test(location.protocol) || !window.fetch) return;
    // أولاً: وقت دقيق بالملّي ثانية من server.js، وإلا ترويسة Date من أي خادم (دقة ثانية)
    measure("api/time", true).then(function (m) { m.src = "server"; return m; })
      .catch(function () { return measure(location.pathname + "?t=" + Date.now(), false).then(function (m) { m.src = "http-date"; return m; }); })
      .then(function (m) {
        var limit = m.src === "server" ? 2000 : 2500;
        offset = Math.abs(m.offset) > limit ? Math.round(m.offset) : 0;
        lastSync = Date.now(); source = m.src;
        try { localStorage.setItem(KEY, String(offset)); } catch (e) {}
      })
      .catch(function () {});
  }

  window.ClockSync = {
    now: function () { return Date.now() + offset; },
    info: function () { return { offset: offset, lastSync: lastSync, source: source }; },
    sync: sync
  };
  sync();
  setInterval(sync, 6 * 3600 * 1000);
})();
