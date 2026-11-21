/*
 * الإصدار ١٠: النسخة الاحتياطية الكاملة في ملف واحد (JSON):
 * { kind: "mosque-clock-backup", version: 10, created, settings, announcements, table }
 * وتقبل الاستعادة أيضاً ملف الإعدادات القديم (الإصدار ٩ وما قبله) الذي فيه الإعدادات وحدها.
 */
(function (root) {
  var KIND = "mosque-clock-backup";
  function build(settings, announcements, table, now) {
    return { kind: KIND, version: 10, created: (now || new Date()).toISOString(), settings: settings || {},
      announcements: Array.isArray(announcements) ? announcements : null, table: table && typeof table === "object" ? table : null };
  }
  function parse(text) {
    var j = typeof text === "string" ? JSON.parse(text) : text;
    if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error("ملف غير صالح");
    if (j.kind === KIND) {
      if (!j.settings || typeof j.settings !== "object") throw new Error("النسخة لا تحوي إعدادات");
      return { settings: j.settings, announcements: Array.isArray(j.announcements) ? j.announcements : null, table: j.table && typeof j.table === "object" ? j.table : null, full: true, created: j.created || "" };
    }
    return { settings: j, announcements: null, table: null, full: false, created: "" }; // ملف إعدادات قديم
  }
  function fileName(d) {
    d = d || new Date();
    return "mosque-clock-backup-" + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + ".json";
  }
  var api = { build: build, parse: parse, fileName: fileName, KIND: KIND };
  root.ClockBackup = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
