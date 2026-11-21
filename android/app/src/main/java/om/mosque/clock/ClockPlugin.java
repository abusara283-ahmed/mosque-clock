package om.mosque.clock;

import android.net.Uri;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.BridgeWebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * يربط الساعة بـ Capacitor: يضيف الجسر window.AndroidClock قبل تحميل أول صفحة،
 * ويسمح بفتح خادم المسجد داخل التطبيق، ويعيد إنشاء الشاشة إن انهار محرك الصفحة.
 */
@CapacitorPlugin(name = "MosqueClock")
public class ClockPlugin extends Plugin {
    /** آخر خطأ تحميل للصفحة الرئيسية (يُعرض في error.html لتسهيل التشخيص) */
    static volatile String lastError = "";

    static void noteError(String url, String why) {
        lastError = why + " — " + url;
        Log.e("MosqueClock", "main-frame load failed: " + lastError);
    }

    @Override
    public void load() {
        WebView w = getBridge().getWebView();
        w.getSettings().setTextZoom(100);                 // لا يكبّر حجم خط النظام تصميم الشاشة
        w.getSettings().setMediaPlaybackRequiresUserGesture(false);
        w.setKeepScreenOn(false);
        if (getActivity() instanceof MainActivity) {
            w.addJavascriptInterface(new ClockBridge((MainActivity) getActivity()), "AndroidClock");
        }
        // نسجّل سبب فشل التحميل ورابطه قبل أن يفتح Capacitor صفحة الخطأ
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) noteError(String.valueOf(req.getUrl()), "خطأ " + err.getErrorCode() + ": " + err.getDescription());
                super.onReceivedError(view, req, err);
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest req, WebResourceResponse res) {
                if (req.isForMainFrame()) noteError(String.valueOf(req.getUrl()), "HTTP " + res.getStatusCode());
                super.onReceivedHttpError(view, req, res);
            }
        });
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // انهار محرك الصفحة (نفاد الذاكرة في صناديق التلفاز الضعيفة): نعيد إنشاء الشاشة بدل إغلاق التطبيق
                getActivity().runOnUiThread(() -> getActivity().recreate());
                return true;
            }
        });
    }

    /** خادم المسجد (رابط بديل اختاره المستخدم) يُفتح داخل التطبيق لا في المتصفح */
    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        String remote = Prefs.startUrl(getContext());
        if (remote == null || remote.isEmpty() || url == null || url.getHost() == null) return null;
        Uri r = Uri.parse(remote);
        if (url.getHost().equalsIgnoreCase(r.getHost()) && url.getPort() == r.getPort()) return false;
        return null;
    }
}
