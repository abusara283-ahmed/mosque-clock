package com.getcapacitor;
public abstract class WebViewListener {
    public void onPageLoaded(android.webkit.WebView w) {}
    public boolean onRenderProcessGone(android.webkit.WebView w, android.webkit.RenderProcessGoneDetail d) { return false; }
}
