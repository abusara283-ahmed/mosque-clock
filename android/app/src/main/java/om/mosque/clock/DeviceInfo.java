package om.mosque.clock;

import android.app.UiModeManager;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.Build;
import android.util.DisplayMetrics;
import android.webkit.WebView;

/** كشف نوع الجهاز: تلفاز/صندوق ← «شاشة المسجد»، جوال ← «المصلي»، لوحي ← «تابلت». */
final class DeviceInfo {
    private DeviceInfo() {}

    static boolean isTv(Context c) {
        UiModeManager m = (UiModeManager) c.getSystemService(Context.UI_MODE_SERVICE);
        if (m != null && m.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION) return true;
        PackageManager pm = c.getPackageManager();
        if (pm.hasSystemFeature(PackageManager.FEATURE_LEANBACK)) return true;
        if (pm.hasSystemFeature("android.software.leanback_only")) return true;
        if (Build.VERSION.SDK_INT >= 21 && pm.hasSystemFeature(PackageManager.FEATURE_TELEVISION)) return true;
        // صناديق رخيصة لا تعلن أنها تلفاز: لا شاشة لمس = تُدار بالريموت
        return !pm.hasSystemFeature(PackageManager.FEATURE_TOUCHSCREEN);
    }

    static int smallestWidthDp(Context c) { return c.getResources().getConfiguration().smallestScreenWidthDp; }

    static String detectMode(Context c) {
        if (isTv(c)) return "screen";
        return smallestWidthDp(c) >= 600 ? "tablet" : "phone";
    }

    /** قطر الشاشة التقريبي بالبوصة (للمعلومة فقط؛ التلفاز يعلن كثافة اصطلاحية) */
    static double diagonalInches(Context c) {
        DisplayMetrics dm = c.getResources().getDisplayMetrics();
        double w = dm.widthPixels / (double) dm.xdpi, h = dm.heightPixels / (double) dm.ydpi;
        return Math.round(Math.sqrt(w * w + h * h) * 10) / 10.0;
    }

    static String appVersion(Context c) {
        try {
            PackageInfo pi = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            return pi.versionName;
        } catch (Exception e) { return "?"; }
    }

    /** الإصدار الرئيسي لمحرك WebView (مثل 120)، أو 0 إن تعذّر */
    static int webViewMajor(Context c) {
        try {
            PackageInfo pi = Build.VERSION.SDK_INT >= 26 ? WebView.getCurrentWebViewPackage() : null;
            String v = pi != null ? pi.versionName : null;
            if (v == null) {
                String ua = android.webkit.WebSettings.getDefaultUserAgent(c);
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("Chrome/(\\d+)").matcher(ua);
                return m.find() ? Integer.parseInt(m.group(1)) : 0;
            }
            return Integer.parseInt(v.split("\\.")[0]);
        } catch (Exception e) { return 0; }
    }
}
