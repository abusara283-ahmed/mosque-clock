package androidx.activity;
public abstract class OnBackPressedCallback {
    public OnBackPressedCallback(boolean enabled) {}
    public abstract void handleOnBackPressed();
    public final void setEnabled(boolean enabled) {}
}
