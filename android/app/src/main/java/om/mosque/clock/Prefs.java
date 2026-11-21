package om.mosque.clock;

import android.content.Context;
import android.content.SharedPreferences;

/** إعدادات التطبيق الأصلية (منفصلة عن إعدادات الساعة التي تحفظها الصفحة نفسها في localStorage). */
final class Prefs {
    private Prefs() {}
    static SharedPreferences p(Context c) { return c.getSharedPreferences("mosque_clock", Context.MODE_PRIVATE); }

    // ——— الوضع: auto | screen | phone | tablet ———
    static String mode(Context c) { return p(c).getString("mode", "auto"); }
    static boolean modeChosen(Context c) { return p(c).getBoolean("modeChosen", false); }
    static void setMode(Context c, String m) {
        if (!"screen".equals(m) && !"phone".equals(m) && !"tablet".equals(m)) m = "auto";
        p(c).edit().putString("mode", m).putBoolean("modeChosen", true).apply();
    }
    /** الوضع الفعلي بعد الكشف التلقائي */
    static String effectiveMode(Context c) {
        String m = mode(c);
        return "auto".equals(m) ? DeviceInfo.detectMode(c) : m;
    }
    static boolean isScreen(Context c) { return "screen".equals(effectiveMode(c)); }

    // ——— شاشة المسجد ———
    /** التشغيل عند الإقلاع: مفعّل افتراضياً في وضع الشاشة فقط */
    static boolean bootStart(Context c) { return p(c).getBoolean("bootStart", true) && isScreen(c); }
    static boolean bootStartSetting(Context c) { return p(c).getBoolean("bootStart", true); }
    static void setBootStart(Context c, boolean v) { p(c).edit().putBoolean("bootStart", v).apply(); }

    static boolean keepFront(Context c) { return keepFrontSetting(c) && isScreen(c) && System.currentTimeMillis() > p(c).getLong("pausedUntil", 0); }
    static boolean keepFrontSetting(Context c) { return p(c).getBoolean("keepFront", true); }
    static void setKeepFront(Context c, boolean v) { p(c).edit().putBoolean("keepFront", v).apply(); }
    /** مهلة العودة للأمام إن فُتح تطبيق آخر (افتراضياً دقيقتان) */
    static long frontDelayMs(Context c) { return p(c).getLong("frontDelayMs", 120000L); }
    static void setFrontDelayMs(Context c, long ms) { p(c).edit().putLong("frontDelayMs", Math.max(30000L, ms)).apply(); }

    /** بعد خروج مقصود: لا عودة للأمام حتى إعادة التشغيل (أو ١٢ ساعة) */
    static void pauseFront(Context c) { p(c).edit().putLong("pausedUntil", System.currentTimeMillis() + 12L * 3600 * 1000).apply(); }
    static void clearPause(Context c) { p(c).edit().putLong("pausedUntil", 0).apply(); }

    /** تثبيت الشاشة (Lock Task): يمنع الخروج من الساعة بأزرار النظام */
    static boolean pinned(Context c) { return p(c).getBoolean("pinned", false); }
    static void setPinned(Context c, boolean v) { p(c).edit().putBoolean("pinned", v).apply(); }

    /** رابط بديل للساعة (مثل خادم المسجد http://192.168.1.10:8080/) — فارغ = الملفات المضمّنة */
    static String startUrl(Context c) { return p(c).getString("startUrl", ""); }
    static void setStartUrl(Context c, String v) { p(c).edit().putString("startUrl", v == null ? "" : v.trim()).apply(); }

    // ——— سجل الأعطال (لإعادة التشغيل الذاتي) ———
    static long lastCrash(Context c) { return p(c).getLong("lastCrash", 0); }
    static int crashCount(Context c) { return p(c).getInt("crashCount", 0); }
    static void noteCrash(Context c) {
        long now = System.currentTimeMillis();
        int n = now - lastCrash(c) < 10 * 60 * 1000L ? crashCount(c) + 1 : 1;
        p(c).edit().putLong("lastCrash", now).putInt("crashCount", n).commit();
    }
}
