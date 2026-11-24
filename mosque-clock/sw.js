/*
 * عامل الخدمة: يحفظ كل ملفات الساعة ليعمل التطبيق بدون إنترنت.
 * - ملفات الواجهة: من المخزن فوراً، مع تحديث بالخلفية.
 * - البيانات (data/ و api/): من الشبكة أولاً، ومن المخزن عند انقطاعها.
 * غيّر VERSION عند نشر تحديث كبير لإجبار تحديث المخزن.
 */
var VERSION = "mosque-clock-v11";
var FILES = [
  "./", "index.html", "settings.html", "announcements.html", "manifest.webmanifest",
  "css/style.css",
  "js/settings-defaults.js", "js/config.js", "js/content.js", "js/prayertimes.js",
  "js/schedule.js", "js/events.js", "js/timesync.js", "js/announcements.js", "js/app.js",
  "classic.html", "css/mihrab.css", "js/sky.js", "js/mihrab.js", "js/dial.js", "js/seasons.js", "js/sound.js", "data/oman-cities.js",
  "css/look.css", "js/look.js", "js/backgrounds.js", "js/vendor/qrcode.js",
  "data/prayer-table.js", "data/announcements.js",
  "fonts/kufi-arabic.woff2", "fonts/kufi-latin.woff2", "fonts/amiri-arabic.woff2", "fonts/amiri-latin.woff2",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
  // الإصدار ٧ (التفاسير تُحفظ عند أول استخدام لكل منها فقط)
  "css/reader.css", "js/adhkar-data.js", "js/quran.js", "js/fatwa.js", "js/reader.js", "data/fatwas.js",
  "data/quran/quran.js", "fonts/amiri-quran.woff2",
  // نسخة الجوال
  "m.html", "manifest-mobile.webmanifest", "css/mobile.css", "js/mobile-core.js", "js/mobile.js", "js/qibla.js",
  // الإصدار ٨: الأصوات المضمّنة والتحقق والتشغيل التلقائي
  "audio/chime.mp3", "audio/bell.mp3", "audio/soft.mp3", "audio/deep.mp3", "audio/iqama.mp3", "audio/soon.mp3",
  "js/verify.js", "js/autostart-ui.js", "js/ticker.js", "js/android-app.js", "css/tablet.css",
  // الإصدار ١٠
  "js/brightness.js", "js/health.js", "js/fit.js", "js/backup.js", "remote.html"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // الطقس وغيره يمر مباشرة
  if (/\/api\/(time|settings|info|autostart)/.test(url.pathname)) return;
  var dataLike = /\/(data|api)\//.test(url.pathname) && !/\/data\/(quran|tafsir)\//.test(url.pathname); // المصحف والتفاسير ثابتة: من المخزن أولاً

  if (dataLike) {
    e.respondWith(fetch(e.request).then(function (r) {
      var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
      return r;
    }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
    return;
  }

  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    var net = fetch(e.request).then(function (r) {
      if (r.ok) { var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy); }); }
      return r;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});

// نسخة الجوال: لمس التنبيه يفتح التطبيق
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) if (/m\.html/.test(list[i].url) && "focus" in list[i]) return list[i].focus();
    return self.clients.openWindow ? self.clients.openWindow("m.html") : null;
  }));
});
