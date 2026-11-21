package om.mosque.clock;

import android.app.ActivityManager;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import org.json.JSONObject;

/**
 * جسر بين صفحات الساعة والتطبيق (window.AndroidClock). متزامن عمداً ليبقى متوافقاً مع صفحات الإصدار ٨.
 * - الوضع (شاشة/جوال/تابلت) وصفحة البداية.
 * - التشغيل التلقائي، الظهور فوق التطبيقات، البطارية، الشاشة الرئيسية، تثبيت الشاشة.
 * - تنبيهات الأذان والإقامة (إذن الإشعارات والمنبّهات الدقيقة).
 */
public class ClockBridge {
    /** أقل إصدار WebView تعمل عليه الواجهة كما صُممت (inset و gap و aspect-ratio) */
    static final int MIN_WEBVIEW = 87;
    private final MainActivity a;
    ClockBridge(MainActivity a) { this.a = a; }

    private boolean overlayGranted() { return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(a); }

    private boolean batteryIgnored() {
        if (Build.VERSION.SDK_INT < 23) return true;
        PowerManager pm = (PowerManager) a.getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(a.getPackageName());
    }

    private boolean isHome() {
        Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        ResolveInfo r = a.getPackageManager().resolveActivity(i, PackageManager.MATCH_DEFAULT_ONLY);
        return r != null && r.activityInfo != null && a.getPackageName().equals(r.activityInfo.packageName);
    }

    private boolean deviceOwner() {
        DevicePolicyManager dpm = (DevicePolicyManager) a.getSystemService(Context.DEVICE_POLICY_SERVICE);
        return dpm != null && dpm.isDeviceOwnerApp(a.getPackageName());
    }

    private boolean lockTaskActive() {
        ActivityManager am = (ActivityManager) a.getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return false;
        if (Build.VERSION.SDK_INT >= 23) return am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
        return false;
    }

    @JavascriptInterface
    public String status() {
        JSONObject o = new JSONObject();
        try {
            o.put("app", "android");
            o.put("flavor", BuildConfig.FLAVOR);
            o.put("version", DeviceInfo.appVersion(a));
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("release", Build.VERSION.RELEASE);
            o.put("model", Build.MANUFACTURER + " " + Build.MODEL);
            o.put("mode", Prefs.effectiveMode(a));
            o.put("modeSetting", Prefs.mode(a));
            o.put("modeChosen", Prefs.modeChosen(a));
            o.put("detected", DeviceInfo.detectMode(a));
            o.put("tv", DeviceInfo.isTv(a));
            o.put("sw", DeviceInfo.smallestWidthDp(a));
            o.put("inches", DeviceInfo.diagonalInches(a));
            int wv = DeviceInfo.webViewMajor(a);
            o.put("webview", wv);
            o.put("webviewOk", wv == 0 || wv >= MIN_WEBVIEW);
            o.put("minWebview", MIN_WEBVIEW);
            // شاشة المسجد
            o.put("bootStart", Prefs.bootStartSetting(a));
            o.put("keepFront", Prefs.keepFrontSetting(a));
            o.put("overlay", overlayGranted());
            o.put("batteryIgnored", batteryIgnored());
            o.put("isHome", isHome());
            o.put("pinned", lockTaskActive());
            o.put("deviceOwner", deviceOwner());
            o.put("startUrl", Prefs.startUrl(a));
            // تنبيهات المصلي
            o.put("notify", PrayerAlarms.notificationsAllowed(a));
            o.put("exact", PrayerAlarms.canExact(a));
            o.put("alarms", PrayerAlarms.list(a).length());
            JSONObject n = PrayerAlarms.next(a);
            o.put("nextAlarm", n == null ? 0 : n.optLong("at"));
        } catch (Exception ignored) { }
        return o.toString();
    }

    /** الصفحة التي تُفتح حسب الوضع (يستعملها start.html) */
    @JavascriptInterface
    public String startPage() { return a.startPage(); }

    @JavascriptInterface
    public void setMode(String m) { Prefs.setMode(a, m); a.applyModeAndReload(); }

    @JavascriptInterface public void setBootStart(boolean v) { Prefs.setBootStart(a, v); }
    @JavascriptInterface public void setKeepFront(boolean v) { Prefs.setKeepFront(a, v); if (!v) KeepAliveReceiver.cancel(a); }
    @JavascriptInterface public void setFrontDelaySeconds(int s) { Prefs.setFrontDelayMs(a, s * 1000L); }
    @JavascriptInterface public String getStartUrl() { return Prefs.startUrl(a); }

    /** رابط بديل للساعة، مثل http://192.168.1.10:8080/ (فارغ = الملفات المضمّنة) */
    @JavascriptInterface
    public void setStartUrl(String url) {
        String u = url == null ? "" : url.trim();
        if (u.length() > 0 && !u.matches("(?i)^https?://.+")) { toast("الرابط يجب أن يبدأ بـ http:// أو https://"); return; }
        Prefs.setStartUrl(a, u);
        a.applyModeAndReload();
    }

    @JavascriptInterface
    public void requestOverlay() {
        if (overlayGranted()) { toast("الإذن ممنوح ✓"); return; }
        open(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + a.getPackageName())),
                new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION),
                "هذا الجهاز لا يعرض صفحة الإذن. استخدم «جعلها الشاشة الرئيسية» بدلاً منه.");
    }

    @JavascriptInterface
    public void requestIgnoreBattery() {
        if (batteryIgnored()) { toast("مستثناة من توفير البطارية ✓"); return; }
        Intent direct = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + a.getPackageName()));
        Intent list = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
        // نسخة المتجر لا تطلب الاستثناء مباشرة (سياسة Google Play)، بل تفتح القائمة ليختار المستخدم «ساعة المسجد»
        if ("play".equals(BuildConfig.FLAVOR)) open(list, new Intent(Settings.ACTION_SETTINGS), "افتح الإعدادات ← البطارية واستثنِ ساعة المسجد");
        else open(direct, list, "تعذّر فتح إعدادات البطارية");
    }

    /** إعدادات «التشغيل التلقائي» الخاصة ببعض الشركات (شاومي، أوبو، فيفو، هواوي، سامسونج…) */
    @JavascriptInterface
    public void openVendorAutostart() {
        String[][] known = {
                {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
                {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
                {"com.oplus.safecenter", "com.oplus.safecenter.permission.startup.StartupAppListActivity"},
                {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
                {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
                {"com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"},
                {"com.asus.mobilemanager", "com.asus.mobilemanager.MainActivity"},
                {"com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"},
        };
        PackageManager pm = a.getPackageManager();
        for (String[] k : known) {
            Intent i = new Intent().setComponent(new ComponentName(k[0], k[1])).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (pm.resolveActivity(i, 0) != null) {
                try { a.startActivity(i); return; } catch (Exception ignored) { }
            }
        }
        open(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + a.getPackageName())),
                new Intent(Settings.ACTION_SETTINGS), "لا توجد إعدادات تشغيل تلقائي خاصة بهذا الجهاز");
    }

    /** يفعّل (أو يلغي) كون الساعة «الشاشة الرئيسية» ثم يفتح اختيار التطبيق الرئيسي */
    @JavascriptInterface
    public void makeHome() {
        PackageManager pm = a.getPackageManager();
        ComponentName alias = new ComponentName(a, a.getPackageName() + ".HomeAlias");
        boolean home = isHome();
        pm.setComponentEnabledSetting(alias, home ? PackageManager.COMPONENT_ENABLED_STATE_DISABLED : PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        if (home) { toast("لم تعد الساعة الشاشة الرئيسية"); return; }
        Intent pick = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        open(new Intent(Settings.ACTION_HOME_SETTINGS), Intent.createChooser(pick, "اختر «ساعة المسجد» كشاشة رئيسية"),
                "اضغط زر الشاشة الرئيسية واختر «ساعة المسجد» ثم «دائماً»");
    }

    /** تثبيت الشاشة (kiosk): يمنع الخروج بأزرار النظام. بدون «مالك الجهاز» يطلب أندرويد تأكيداً، ويُلغى بالضغط المطوّل على رجوع + نظرة عامة. */
    @JavascriptInterface
    public void setPinned(final boolean on) {
        Prefs.setPinned(a, on);
        a.runOnUiThread(() -> a.applyLockTask(on, true));
    }

    /** يلغي وضع «مالك الجهاز» (إن ضُبط بأمر adb) فيعود الجهاز عادياً ويمكن حذف التطبيق */
    @JavascriptInterface
    public void clearDeviceOwner() {
        a.runOnUiThread(() -> {
            try {
                a.applyLockTask(false, true);
                Prefs.setPinned(a, false);
                DevicePolicyManager dpm = (DevicePolicyManager) a.getSystemService(Context.DEVICE_POLICY_SERVICE);
                if (dpm != null && dpm.isDeviceOwnerApp(a.getPackageName())) dpm.clearDeviceOwnerApp(a.getPackageName());
                toast("أُلغي وضع مالك الجهاز");
            } catch (Exception e) { toast("تعذّر الإلغاء"); }
        });
    }

    // ——— تنبيهات الأذان (وضع المصلي) ———

    /** يطلب إذن الإشعارات (أندرويد ١٣ فأحدث)، أو يفتح إعداداتها إن رُفض سابقاً */
    @JavascriptInterface
    public void requestNotifications() {
        if (PrayerAlarms.notificationsAllowed(a)) { toast("الإشعارات مسموحة ✓"); return; }
        a.runOnUiThread(() -> a.askNotificationPermission());
    }

    /** يفتح صفحة «المنبّهات والتذكيرات» (أندرويد ١٢ فأحدث) ليُسمح بالتنبيه في الدقيقة نفسها */
    @JavascriptInterface
    public void requestExactAlarms() {
        if (PrayerAlarms.canExact(a)) { toast("المنبّهات الدقيقة مسموحة ✓"); return; }
        if (Build.VERSION.SDK_INT >= 31) {
            open(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + a.getPackageName())),
                    new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + a.getPackageName())),
                    "افتح إعدادات التطبيق ← المنبّهات والتذكيرات");
        }
    }

    @JavascriptInterface
    public void openNotificationSettings() {
        Intent i;
        if (Build.VERSION.SDK_INT >= 26) i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, a.getPackageName());
        else i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + a.getPackageName()));
        open(i, new Intent(Settings.ACTION_SETTINGS), "تعذّر فتح إعدادات الإشعارات");
    }

    /** JSON: [{id, at, kind, title, body}] — يُرجع عدد المواعيد المحفوظة */
    @JavascriptInterface
    public int scheduleAlarms(String json) {
        PrayerAlarms.ensureChannels(a);
        return PrayerAlarms.save(a, json);
    }

    @JavascriptInterface public void clearAlarms() { PrayerAlarms.clear(a); }

    /** إشعار تجريبي فوري بصوت القناة المختارة */
    @JavascriptInterface
    public void testNotification(String kind) {
        if (!PrayerAlarms.notificationsAllowed(a)) { requestNotifications(); return; }
        PrayerAlarms.ensureChannels(a);
        try {
            JSONObject o = new JSONObject().put("kind", kind == null ? "adhan" : kind)
                    .put("title", "تجربة: حان الآن أذان الظهر").put("body", "هكذا يصلك تنبيه الأذان والتطبيق مغلق.");
            PrayerAlarms.show(a, o);
        } catch (Exception ignored) { }
    }

    @JavascriptInterface public void exitApp() { a.runOnUiThread(() -> a.exitApp()); }
    @JavascriptInterface public void reload() { a.applyModeAndReload(); }
    @JavascriptInterface public void toastMessage(String m) { toast(m); }

    private void open(final Intent first, final Intent second, final String fail) {
        a.runOnUiThread(() -> {
            try { first.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); a.startActivity(first); return; } catch (Exception ignored) { }
            try { second.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); a.startActivity(second); return; } catch (Exception ignored) { }
            Toast.makeText(a, fail, Toast.LENGTH_LONG).show();
        });
    }

    private void toast(final String m) {
        a.runOnUiThread(() -> Toast.makeText(a, m, Toast.LENGTH_SHORT).show());
    }
}
