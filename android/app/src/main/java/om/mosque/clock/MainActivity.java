package om.mosque.clock;

import android.app.ActivityManager;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

/**
 * ساعة المسجد (الإصدار ٩، Capacitor). شاشة واحدة تعرض الساعة من ملفات التطبيق (بلا إنترنت) بثلاثة أوضاع:
 * - «شاشة المسجد» (التلفاز وصناديق أندرويد والشاشات المعلّقة): ملء الشاشة، لا تنطفئ، تشتغل عند الإقلاع وتعود للأمام.
 * - «المصلي» على الجوال، و«التابلت»: تطبيق عادي بأشرطة النظام، وتنبيهات الأذان والإقامة تعمل والتطبيق مغلق.
 */
public class MainActivity extends BridgeActivity {
    static volatile boolean visible = false;
    private static final int REQ_NOTIF = 41;
    private int backPresses = 0;
    private long firstBack = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ClockPlugin.class);
        super.onCreate(savedInstanceState);
        applyWindowMode();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() { onBack(); }
        });
    }

    boolean isScreen() { return Prefs.isScreen(this); }

    /** صفحة البداية حسب الوضع؛ ورابط خادم المسجد إن اختير (لوضع الشاشة) */
    String startPage() {
        String mode = Prefs.effectiveMode(this);
        String remote = Prefs.startUrl(this);
        if ("screen".equals(mode) && remote != null && remote.length() > 0) return remote;
        String base = bridge != null ? bridge.getLocalUrl() + "/" : "https://localhost/";
        if ("screen".equals(mode)) return base + "index.html?kiosk=1&app=android";
        return base + "m.html?app=android" + ("tablet".equals(mode) ? "&tablet=1" : "");
    }

    void applyModeAndReload() {
        runOnUiThread(() -> {
            applyWindowMode();
            if (bridge != null) bridge.getWebView().loadUrl(bridge.getLocalUrl() + "/start.html");
        });
    }

    @SuppressWarnings("deprecation")
    void applyWindowMode() {
        int f = WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD;
        if (isScreen()) {
            getWindow().addFlags(f);
            if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
            hideSystemBars();
        } else {
            getWindow().clearFlags(f);
            if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(false); setTurnScreenOn(false); }
            showSystemBars();
        }
    }

    @SuppressWarnings("deprecation")
    void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @SuppressWarnings("deprecation")
    void showSystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) c.show(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }

    // ——— تثبيت الشاشة (Lock Task) ———
    boolean lockTaskActive() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        return am != null && Build.VERSION.SDK_INT >= 23 && am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }

    void applyLockTask(boolean on, boolean user) {
        try {
            DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
            ComponentName admin = new ComponentName(this, AdminReceiver.class);
            boolean owner = dpm != null && dpm.isDeviceOwnerApp(getPackageName());
            if (on) {
                if (owner) {
                    // «مالك الجهاز» (يُضبط مرة بأمر adb): قفل كامل بلا تأكيد، وبلا شاشة قفل، والشاشة مضاءة ما دام موصولاً بالكهرباء
                    dpm.setLockTaskPackages(admin, new String[]{getPackageName()});
                    if (Build.VERSION.SDK_INT >= 23) dpm.setKeyguardDisabled(admin, true);
                    dpm.setGlobalSetting(admin, Settings.Global.STAY_ON_WHILE_PLUGGED_IN, "7");
                }
                if (!lockTaskActive()) startLockTask();
            } else if (lockTaskActive()) {
                stopLockTask();
            }
        } catch (Exception e) {
            if (user) android.widget.Toast.makeText(this, "تعذّر تثبيت الشاشة على هذا الجهاز", android.widget.Toast.LENGTH_LONG).show();
        }
    }

    // ——— إذن الإشعارات (أندرويد ١٣ فأحدث) ———
    void askNotificationPermission() {
        String perm = "android.permission.POST_NOTIFICATIONS";
        boolean askedBefore = Prefs.p(this).getBoolean("notifAsked", false);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(perm) != android.content.pm.PackageManager.PERMISSION_GRANTED
                && (!askedBefore || shouldShowRequestPermissionRationale(perm))) {
            Prefs.p(this).edit().putBoolean("notifAsked", true).apply();
            requestPermissions(new String[]{perm}, REQ_NOTIF);
            return;
        }
        // رُفض نهائياً أو الإشعارات مطفأة من الإعدادات: نفتح صفحتها
        Intent i = Build.VERSION.SDK_INT >= 26
                ? new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())
                : new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName()));
        try { startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_NOTIF) js("window.dispatchEvent(new Event('androidstatus'))");
    }

    void js(String code) {
        if (bridge != null && bridge.getWebView() != null) bridge.getWebView().evaluateJavascript(code, null);
    }

    // ——— دورة الحياة ———
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && isScreen()) hideSystemBars();
    }

    @Override
    public void onResume() {
        super.onResume();
        visible = true;
        Prefs.clearPause(this);
        applyWindowMode();
        if (isScreen() && Prefs.pinned(this)) applyLockTask(true, false);
        PrayerAlarms.rescheduleAll(this);
        js("window.dispatchEvent(new Event('androidstatus'))");
    }

    @Override
    public void onStop() {
        super.onStop();
        visible = false;
        // إن غطّاها تطبيق آخر ولم يطلب المستخدم الخروج: تعود للأمام بعد مهلة (وضع الشاشة فقط)
        if (!isFinishing() && Prefs.keepFront(this)) KeepAliveReceiver.schedule(this, Prefs.frontDelayMs(this), false);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (isScreen()) hideSystemBars();
    }

    // ——— الريموت وزر الرجوع ———
    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        if (e.getAction() == KeyEvent.ACTION_UP && (k == KeyEvent.KEYCODE_MENU || k == KeyEvent.KEYCODE_SETTINGS || k == KeyEvent.KEYCODE_GUIDE)) {
            js("window.ClockRemote && ClockRemote.menu()");
            return true;
        }
        if (k == KeyEvent.KEYCODE_MENU || k == KeyEvent.KEYCODE_SETTINGS || k == KeyEvent.KEYCODE_GUIDE) return true;
        return super.dispatchKeyEvent(e);
    }

    /** الرجوع: يغلق القوائم داخل الصفحة أولاً، ثم يرجع للصفحة السابقة (من الإعدادات للساعة). */
    void onBack() {
        if (bridge == null) { finish(); return; }
        final WebView w = bridge.getWebView();
        w.evaluateJavascript("(window.ClockRemote && ClockRemote.back()) ? 1 : 0", r -> {
            if ("1".equals(r)) return;
            if (w.canGoBack()) { w.goBack(); return; }
            if (!isScreen()) { moveTaskToBack(true); return; }   // الجوال: يبقى في الخلفية والتنبيهات تعمل
            // شاشة المسجد: للخروج اضغط الرجوع ٥ مرات خلال ٣ ثوانٍ
            long now = System.currentTimeMillis();
            if (now - firstBack > 3000) { firstBack = now; backPresses = 0; }
            if (++backPresses >= 5) exitApp();
            else if (backPresses == 3) android.widget.Toast.makeText(this, "اضغط الرجوع مرتين أخريين للخروج", android.widget.Toast.LENGTH_SHORT).show();
        });
    }

    /** خروج مقصود: لا تعود الساعة للأمام حتى إعادة تشغيل الجهاز أو فتحها يدوياً */
    void exitApp() {
        Prefs.pauseFront(this);
        KeepAliveReceiver.cancel(this);
        if (lockTaskActive()) { try { stopLockTask(); } catch (Exception ignored) { } }
        finishAndRemoveTask();
    }
}
