#!/usr/bin/env node
/*
 * خادم محلي اختياري (بدون مكتبات إضافية) لتشغيل الساعة على جهاز المسجد:
 *   node server.js            ثم افتح http://localhost:8080 على الشاشة
 * ومن الجوال على نفس شبكة الواي فاي افتح http://<عنوان-الجهاز>:8080/announcements.html
 * يوفّر:
 *   GET  /api/time            وقت الخادم لتصحيح انحراف الساعة
 *   GET  /api/announcements   قائمة الإعلانات
 *   POST /api/announcements   حفظ الإعلانات (يتطلب الرمز السري في الترويسة X-Pin)
 *   GET  /api/info            عناوين الجهاز على الشبكة (لرمز QR في الشاشة)
 *   GET  /api/settings        آخر إعدادات حُفظت من الجوال {rev, settings}
 *   POST /api/settings        حفظ الإعدادات من الجوال (يتطلب X-Pin)، والشاشة تسحبها خلال ٢٠ ثانية
 *   GET  /api/autostart       الإصدار ٨: حالة التشغيل التلقائي على هذا الجهاز (ويندوز أو لينكس)
 *   POST /api/autostart       {action:"enable"|"disable"} تفعيل أو إزالة التشغيل التلقائي (يتطلب X-Pin)
 * الرمز السري: متغير البيئة CLOCK_PIN، والافتراضي 1234 (غيّره!).
 */
var http = require("http"), fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
var ROOT = __dirname, PORT = +process.env.PORT || 8080, PIN = process.env.CLOCK_PIN || "1234";
var ANN = path.join(ROOT, "data", "announcements.json");
var SET = path.join(ROOT, "data", "settings.json");
function lanIPs() {
  var ips = [];
  Object.values(os.networkInterfaces()).forEach(function (l) { (l || []).forEach(function (i) { if (i.family === "IPv4" && !i.internal) ips.push(i.address); }); });
  return ips;
}
// الإصدار ٧: حدّ الطلب ٦ ميغابايت لأن الفتاوى والشعار صارت ضمن الإعدادات
function readBody(req, cb) {
  var body = "";
  req.on("data", function (c) { body += c; if (body.length > 6e6) req.destroy(); });
  req.on("end", function () { cb(body); });
}
var TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".csv": "text/csv; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8" };

function send(res, code, body, type, cors) {
  var h = { "Content-Type": type || "application/json; charset=utf-8", "Cache-Control": "no-cache" };
  // الإصدار ٩: تطبيق أندرويد على جوال المصلي يقرأ المواقيت والوقت من الخادم (قراءة فقط)
  if (cors) h["Access-Control-Allow-Origin"] = "*";
  res.writeHead(code, h);
  res.end(body);
}

// ——— الإصدار ٨: التشغيل التلقائي من صفحة الإعدادات (يشغّل سكربتات مجلد autostart على هذا الجهاز) ———
function autostart(action, cb) {
  var cmd, args;
  if (process.platform === "win32") {
    cmd = "powershell.exe";
    args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(ROOT, "autostart", "windows", "mosque-clock.ps1"), "-Action", action, "-Quiet"];
    if (action === "install") args.push("-NoStart");
  } else if (process.platform === "linux") {
    var dir = path.join(ROOT, "autostart", "linux");
    cmd = "bash";
    args = action === "status" ? [path.join(dir, "install.sh"), "--status"] : action === "install" ? [path.join(dir, "install.sh"), "--quiet", "--no-start"] : [path.join(dir, "uninstall.sh"), "--quiet"];
  } else return cb(1, JSON.stringify({ platform: process.platform, supported: false }));
  cp.execFile(cmd, args, { cwd: ROOT, timeout: 60000, windowsHide: true }, function (err, stdout, stderr) {
    cb(err ? (err.code || 1) : 0, String(stdout || "") + String(stderr || ""));
  });
}
function statusJSON(code, out) {
  var m = /\{[\s\S]*\}/.exec(String(out || ""));
  try { var j = JSON.parse(m ? m[0] : ""); j.supported = j.supported !== false; return JSON.stringify(j); }
  catch (e) { return JSON.stringify({ platform: process.platform, supported: false, error: "status" }); }
}
function savePin() {
  var dir = process.platform === "win32" ? path.join(process.env.LOCALAPPDATA || os.homedir(), "MosqueClock") : path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"), "mosque-clock");
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, "pin.txt"), PIN, { mode: 384 }); } catch (e) {}
}

http.createServer(function (req, res) {
  var url = new URL(req.url, "http://x");
  if (url.pathname === "/api/time") return send(res, 200, JSON.stringify({ now: Date.now() }), null, true);

  if (url.pathname === "/api/info") {
    return send(res, 200, JSON.stringify({ urls: lanIPs().map(function (ip) { return "http://" + ip + ":" + PORT; }) }));
  }

  if (url.pathname === "/api/settings") {
    if (req.method === "GET") {
      fs.readFile(SET, "utf8", function (err, txt) { send(res, 200, err ? JSON.stringify({ rev: 0, settings: null }) : txt, null, true); });
      return;
    }
    if (req.method === "POST") {
      // X-Seed: الشاشة تضع إعداداتها أول مرة فقط (حين لا يوجد ملف)، ليبدأ الجوال منها لا من الافتراضي
      var seed = req.headers["x-seed"] === "1" && !fs.existsSync(SET);
      if (!seed && req.headers["x-pin"] !== PIN) return send(res, 403, JSON.stringify({ error: "pin" }));
      return readBody(req, function (body) {
        try {
          var obj = JSON.parse(body);
          if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw 0;
          var rev = Date.now(), out = JSON.stringify({ rev: rev, settings: obj }, null, 2);
          fs.writeFile(SET, out, function (err) { send(res, err ? 500 : 200, JSON.stringify({ ok: !err, rev: rev })); });
        } catch (e) { send(res, 400, JSON.stringify({ error: "json" })); }
      });
    }
    return send(res, 405, "{}");
  }

  if (url.pathname === "/api/autostart") {
    if (req.method === "GET") return autostart("status", function (code, out) { send(res, 200, statusJSON(code, out)); });
    if (req.method === "POST") {
      if (req.headers["x-pin"] !== PIN) return send(res, 403, JSON.stringify({ error: "pin" }));
      return readBody(req, function (body) {
        var action; try { action = JSON.parse(body).action; } catch (e) {}
        if (action !== "enable" && action !== "disable") return send(res, 400, JSON.stringify({ error: "action" }));
        if (action === "enable" && PIN !== "1234") savePin();
        autostart(action === "enable" ? "install" : "uninstall", function (code, out) {
          autostart("status", function (c2, st) { send(res, code === 0 ? 200 : 500, JSON.stringify({ ok: code === 0, status: JSON.parse(statusJSON(c2, st)), log: String(out).slice(-800) })); });
        });
      });
    }
    return send(res, 405, "{}");
  }

  if (url.pathname === "/api/announcements") {
    if (req.method === "GET") {
      fs.readFile(ANN, "utf8", function (err, txt) { if (err) send(res, 404, "[]"); else send(res, 200, txt); }); // 404 = استخدم الإعلانات الافتراضية
      return;
    }
    if (req.method === "POST") {
      if (req.headers["x-pin"] !== PIN) return send(res, 403, JSON.stringify({ error: "pin" }));
      var body = "";
      req.on("data", function (c) { body += c; if (body.length > 6e6) req.destroy(); });
      req.on("end", function () {
        try {
          var list = JSON.parse(body);
          if (!Array.isArray(list)) throw 0;
          fs.writeFile(ANN, JSON.stringify(list, null, 2), function (err) {
            send(res, err ? 500 : 200, JSON.stringify({ ok: !err }));
          });
        } catch (e) { send(res, 400, JSON.stringify({ error: "json" })); }
      });
      return;
    }
    return send(res, 405, "{}");
  }

  var file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (file !== ROOT && file.indexOf(ROOT + path.sep) !== 0) return send(res, 403, "", "text/plain");
  if (url.pathname.endsWith("/")) file = path.join(file, "index.html");
  if (/server\.js$|\/tests\//.test(file)) return send(res, 404, "", "text/plain");
  fs.readFile(file, function (err, data) {
    if (err) return send(res, 404, "not found", "text/plain");
    send(res, 200, data, TYPES[path.extname(file)] || "application/octet-stream");
  });
}).listen(PORT, function () {
  var ips = lanIPs();
  console.log("ساعة المسجد تعمل:  http://localhost:" + PORT);
  ips.forEach(function (ip) { console.log("التحكم من الجوال:  http://" + ip + ":" + PORT + "/settings.html  (أو امسح رمز QR من قائمة النجمة)"); });
  if (PIN === "1234") console.log("تنبيه: الرمز السري الافتراضي 1234، غيّره بتشغيل  CLOCK_PIN=xxxx node server.js");
});
