package om.mosque.clock;

import android.net.Uri;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import com.getcapacitor.Plugin;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * يربط الساعة بـ Capacitor: يضيف الجسر window.AndroidClock قبل تحميل أول صفحة،
 * ويسمح بفتح خادم المسجد داخل التطبيق، ويعيد إنشاء الشاشة إن انهار محرك الصفحة.
 */
@CapacitorPlugin(name = "MosqueClock")
public class ClockPlugin extends Plugin {
    @Override
    public void load() {
        WebView w = getBridge().getWebView();
        w.getSettings().setTextZoom(100);                 // لا يكبّر حجم خط النظام تصميم الشاشة
        w.getSettings().setMediaPlaybackRequiresUserGesture(false);
        w.setKeepScreenOn(false);
        if (getActivity() instanceof MainActivity) {
            w.addJavascriptInterface(new ClockBridge((MainActivity) getActivity()), "AndroidClock");
        }
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
