package io.github.jindosz.audiogear;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.LinkedHashSet;
import java.util.Set;
import org.json.JSONException;

/**
 * 웹 화면(src/eqEngine.ts)과 SystemEqService를 잇는 Capacitor 플러그인.
 * 웹에서 registerPlugin('SystemEq')로 불러 apply / off / status를 부르고,
 * 알림의 "끄기"처럼 앱 밖에서 상태가 바뀌면 "statusChange" 이벤트로 알려 준다.
 */
@CapacitorPlugin(name = "SystemEq")
public class SystemEqPlugin extends Plugin {

    private final SystemEqService.Listener listener = s -> notifyListeners("statusChange", toJs(s));

    @Override
    public void load() {
        SystemEqService.setListener(listener);
    }

    @Override
    protected void handleOnDestroy() {
        // 새 화면이 이미 자기 리스너를 등록했을 수 있어서, 내 것일 때만 지운다
        SystemEqService.clearListener(listener);
    }

    /** EQ 걸기(이미 켜져 있으면 값만 바꿈). 결과 상태는 statusChange 이벤트로 온다 */
    @PluginMethod
    public void apply(PluginCall call) {
        float[] cutoffs;
        float[] gains;
        try {
            cutoffs = toFloats(call.getArray("cutoffs"));
            gains = toFloats(call.getArray("gains"));
        } catch (JSONException e) {
            call.reject("EQ 값을 읽지 못했습니다: " + e.getMessage());
            return;
        }
        if (cutoffs.length == 0 || cutoffs.length != gains.length) {
            call.reject("밴드 수가 맞지 않습니다");
            return;
        }
        askNotificationPermissionOnce();
        Intent intent = new Intent(getContext(), SystemEqService.class)
                .setAction(SystemEqService.ACTION_APPLY)
                .putExtra(SystemEqService.EXTRA_NAME, call.getString("name", "EQ"))
                .putExtra(SystemEqService.EXTRA_CUTOFFS, cutoffs)
                .putExtra(SystemEqService.EXTRA_GAINS, gains)
                .putExtra(SystemEqService.EXTRA_INPUT_GAIN, call.getFloat("inputGain", 0f));
        getContext().startForegroundService(intent);
        call.resolve();
    }

    /** EQ 끄기 */
    @PluginMethod
    public void off(PluginCall call) {
        if (SystemEqService.getStatus().on) {
            getContext().startForegroundService(
                    new Intent(getContext(), SystemEqService.class).setAction(SystemEqService.ACTION_OFF));
        }
        call.resolve();
    }

    /** 지금 상태 */
    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(toJs(SystemEqService.getStatus()));
    }

    /**
     * 적용 대상과 고를 수 있는 앱 목록.
     * { mode: "all"|"apps", apps: [고른 앱], seen: [{ package, label }] } — seen은 EQ가 켜져 있는 동안 신호를 보낸 적 있는 앱
     */
    @PluginMethod
    public void targets(PluginCall call) {
        SharedPreferences p = prefs();
        JSObject result = new JSObject();
        result.put("mode", EqTargeting.normalizeMode(p.getString(SystemEqService.KEY_TARGET_MODE, EqTargeting.ALL)));
        JSArray apps = new JSArray();
        for (String pkg : EqTargeting.parseList(p.getString(SystemEqService.KEY_TARGET_APPS, ""))) apps.put(pkg);
        result.put("apps", apps);
        JSArray seen = new JSArray();
        for (String pkg : EqTargeting.parseList(p.getString(SystemEqService.KEY_SEEN_APPS, ""))) {
            JSObject app = new JSObject();
            app.put("package", pkg);
            app.put("label", appLabel(pkg));
            seen.put(app);
        }
        result.put("seen", seen);
        call.resolve(result);
    }

    /** 적용 대상 바꾸기. 저장하고, EQ가 켜져 있으면 서비스가 바로 다시 적용한다 */
    @PluginMethod
    public void setTargets(PluginCall call) {
        Set<String> apps = new LinkedHashSet<>();
        JSArray array = call.getArray("apps");
        if (array != null) {
            for (int i = 0; i < array.length(); i++) {
                String pkg = array.optString(i, "");
                if (!pkg.isEmpty()) apps.add(pkg);
            }
        }
        prefs().edit()
                .putString(SystemEqService.KEY_TARGET_MODE, EqTargeting.normalizeMode(call.getString("mode")))
                .putString(SystemEqService.KEY_TARGET_APPS, EqTargeting.joinList(apps))
                .apply();
        if (SystemEqService.getStatus().on) {
            getContext().startForegroundService(
                    new Intent(getContext(), SystemEqService.class).setAction(SystemEqService.ACTION_TARGETS));
        }
        call.resolve();
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(SystemEqService.PREFS, Context.MODE_PRIVATE);
    }

    /** 앱 이름(예: "Spotify"). 못 읽으면 패키지 이름 그대로(AndroidManifest의 <queries>로 실행 가능한 앱만 보임) */
    private String appLabel(String pkg) {
        try {
            PackageManager pm = getContext().getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(info).toString();
        } catch (PackageManager.NameNotFoundException e) {
            return pkg;
        }
    }

    private static JSObject toJs(SystemEqService.Status s) {
        JSObject o = new JSObject();
        o.put("on", s.on);
        if (s.name != null) o.put("name", s.name);
        if (s.mode != null) o.put("mode", s.mode);
        if (s.error != null) o.put("error", s.error);
        return o;
    }

    private static float[] toFloats(JSArray array) throws JSONException {
        if (array == null) return new float[0];
        float[] out = new float[array.length()];
        for (int i = 0; i < out.length; i++) out[i] = (float) array.getDouble(i);
        return out;
    }

    /**
     * 안드로이드 13부터 알림을 띄우려면 허락이 필요하다. 거절해도 EQ는 걸린다(알림만 안 보임, EQ 화면 맨 위에서 끌 수 있음).
     * 적용할 때마다 묻지 않게 처음 한 번만 묻는다
     */
    private void askNotificationPermissionOnce() {
        if (Build.VERSION.SDK_INT < 33 || getActivity() == null) return;
        if (getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        SharedPreferences prefs = getContext().getSharedPreferences(SystemEqService.PREFS, Context.MODE_PRIVATE);
        if (prefs.getBoolean("askedNotification", false)) return;
        prefs.edit().putBoolean("askedNotification", true).apply();
        getActivity().runOnUiThread(() ->
                getActivity().requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 7301));
    }
}
