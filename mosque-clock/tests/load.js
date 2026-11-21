/* تحميل ملفات الساعة داخل Node للاختبار */
var path = require("path"), fs = require("fs"), vm = require("vm");
module.exports = function load() {
  var store = {};
  var ctx = { console: console, localStorage: { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ["js/settings-defaults.js", "js/config.js", "js/prayertimes.js", "js/schedule.js", "js/events.js", "js/dial.js", "js/seasons.js", "js/sky.js"].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), ctx, { filename: f });
  });
  return ctx;
};
