package io.github.jindosz.audiogear;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.drawable.Icon;
import android.media.audiofx.AudioEffect;
import android.media.audiofx.DynamicsProcessing;
import android.os.Build;
import android.os.IBinder;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * 폰 전체 소리에 EQ를 거는 포그라운드 서비스.
 * "포그라운드 서비스"는 알림을 하나 띄워 두고 화면을 닫아도 계속 살아 있는 앱 부품이다.
 * EQ 효과(DynamicsProcessing) 객체를 여기서 들고 있어야 앱 화면을 닫아도 EQ가 풀리지 않는다.
 *
 * 방식(시험 앱 android-spike로 갤럭시 폴드7에서 확인):
 *  ① 전체 출력(세션 0)에 건다 — 기본
 *  ② ①이 안 되면(만들기 실패, 제어권 없음) 재생 앱이 보내는 "오디오 세션 열림" 신호를 받아 그 앱 소리에 건다
 *  ③ "고른 앱만"(2026-11-21): ①을 쓰지 않고, 고른 앱이 보낸 세션에만 건다(어디에 걸지는 EqTargeting)
 * 켜져 있는 동안은 방식과 상관없이 신호를 받아 "신호를 보낸 앱"을 기억한다(앱 화면의 고를 수 있는 앱 목록)
 * EQ를 바꿀 때는 효과를 새로 만들지 않고 값만 바꾼다(소리가 끊기지 않게, 0.3초 간격 변경도 시험 완료).
 * 계산은 웹 코드(src/eqDevice.ts)가 하고, 여기서는 받은 밴드 값만 건다.
 */
public class SystemEqService extends Service {

    public static final String ACTION_APPLY = "io.github.jindosz.audiogear.EQ_APPLY";
    public static final String ACTION_OFF = "io.github.jindosz.audiogear.EQ_OFF";
    /** 저장해 둔 마지막 EQ를 다시 건다(폰을 다시 켰을 때 BootReceiver가 보냄). 꺼짐으로 저장돼 있으면 아무것도 안 함 */
    public static final String ACTION_RESTORE = "io.github.jindosz.audiogear.EQ_RESTORE";
    /** 적용 대상(모든 앱/고른 앱)이 바뀜. 값은 SharedPreferences에 이미 저장돼 있고 서비스는 다시 읽어 적용만 한다 */
    public static final String ACTION_TARGETS = "io.github.jindosz.audiogear.EQ_TARGETS";
    /** SharedPreferences 열쇠: 적용 대상 방식("all"/"apps"), 고른 앱, 신호를 보낸 적 있는 앱(쉼표로 잇기) */
    static final String KEY_TARGET_MODE = "target_mode";
    static final String KEY_TARGET_APPS = "target_apps";
    static final String KEY_SEEN_APPS = "seen_apps";
    public static final String EXTRA_NAME = "name";
    public static final String EXTRA_CUTOFFS = "cutoffs";
    public static final String EXTRA_GAINS = "gains";
    public static final String EXTRA_INPUT_GAIN = "inputGain";

    private static final String CHANNEL_ID = "system_eq";
    private static final int NOTIFICATION_ID = 1;
    /** 재생 앱 신호 방식에서 동시에 들고 있을 효과의 최대 개수(신호를 마구 보내는 앱이 있어도 메모리가 새지 않게) */
    private static final int MAX_SESSIONS = 16;
    /** 신호로 알게 된 세션을 기억해 두는 최대 개수(효과를 안 붙인 세션 포함) */
    private static final int MAX_KNOWN_SESSIONS = 64;
    /** 효과끼리 경쟁할 때 우선순위. 높을수록 이긴다 */
    private static final int PRIORITY = Integer.MAX_VALUE;
    /** 마지막으로 건 EQ를 저장해 두는 곳(3단계: 폰을 다시 켰을 때 복원용) */
    static final String PREFS = "system_eq";

    /** 지금 상태. 화면(SystemEqPlugin)이 읽어 간다 */
    public static final class Status {
        public boolean on;
        public String name;
        /** "global" = ① 전체 출력, "sessions" = ② 재생 앱 신호, "apps" = ③ 고른 앱만 */
        public String mode;
        public String error;

        Status copy() {
            Status s = new Status();
            s.on = on;
            s.name = name;
            s.mode = mode;
            s.error = error;
            return s;
        }
    }

    /** 상태가 바뀔 때 알려 줄 곳(SystemEqPlugin → 앱 화면) */
    public interface Listener {
        void onStatus(Status status);
    }

    private static final Status status = new Status();
    private static Listener listener;

    public static synchronized Status getStatus() {
        return status.copy();
    }

    public static synchronized void setListener(Listener l) {
        listener = l;
    }

    /** l이 지금 등록된 리스너일 때만 지운다 */
    public static synchronized void clearListener(Listener l) {
        if (listener == l) listener = null;
    }

    private static void publish(boolean on, String name, String mode, String error) {
        Listener l;
        Status snapshot;
        synchronized (SystemEqService.class) {
            status.on = on;
            status.name = name;
            status.mode = mode;
            status.error = error;
            l = listener;
            snapshot = status.copy();
        }
        if (l != null) l.onStatus(snapshot);
    }

    private DynamicsProcessing globalEffect;
    private final Map<Integer, DynamicsProcessing> sessionEffects = new LinkedHashMap<>();
    private boolean receiverRegistered = false;
    /** 신호를 보낸 세션 → 앱 이름. 효과를 안 붙인 세션도 기억해서, 고른 앱이 바뀌면 이미 재생 중인 앱에도 바로 붙이고 뗀다 */
    private final Map<Integer, String> knownSessions = new LinkedHashMap<>();
    private String targetMode = EqTargeting.ALL;
    private Set<String> targetApps = new LinkedHashSet<>();

    private String name = "";
    private float[] cutoffs = new float[0];
    private float[] gains = new float[0];
    private float inputGain = 0f;

    /** 재생 앱이 보내는 "오디오 세션 열림/닫힘" 신호를 받는 곳(②·③ 방식, 그리고 앱 목록 기억) */
    private final BroadcastReceiver sessionReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            int session = intent.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, AudioEffect.ERROR_BAD_VALUE);
            if (session == AudioEffect.ERROR_BAD_VALUE) return;
            if (AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION.equals(intent.getAction())) {
                String pkg = intent.getStringExtra(AudioEffect.EXTRA_PACKAGE_NAME);
                rememberSeen(pkg);
                knownSessions.remove(session);
                knownSessions.put(session, pkg);
                // 오래된 것부터 잊는다(LinkedHashMap이라 넣은 순서가 유지됨)
                while (knownSessions.size() > MAX_KNOWN_SESSIONS) {
                    Integer oldest = knownSessions.keySet().iterator().next();
                    knownSessions.remove(oldest);
                    DynamicsProcessing old = sessionEffects.remove(oldest);
                    if (old != null) old.release();
                }
                syncSession(session, pkg);
            } else if (AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION.equals(intent.getAction())) {
                knownSessions.remove(session);
                DynamicsProcessing effect = sessionEffects.remove(session);
                if (effect != null) effect.release();
            }
        }
    };

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // startForegroundService로 불렀으면 5초 안에 알림을 띄워야 해서, 무슨 명령이든 먼저 띄운다
        startInForeground();
        // intent가 null = 시스템이 서비스를 정리했다가 다시 살린 경우(START_STICKY). 마지막 EQ를 다시 건다
        String action = intent != null ? intent.getAction() : ACTION_RESTORE;
        loadTargets();
        if (ACTION_TARGETS.equals(action)) {
            // 켜져 있을 때만 다시 적용(꺼져 있으면 저장만 돼 있고 다음에 켤 때 쓰인다)
            if (getStatus().on || loadLast()) applyEq();
            else publish(false, null, null, null);
        } else if (ACTION_RESTORE.equals(action)) {
            if (loadLast()) applyEq();
            else publish(false, null, null, null);
        } else if (ACTION_APPLY.equals(action)) {
            name = intent.getStringExtra(EXTRA_NAME);
            if (name == null) name = "EQ";
            float[] c = intent.getFloatArrayExtra(EXTRA_CUTOFFS);
            float[] g = intent.getFloatArrayExtra(EXTRA_GAINS);
            cutoffs = c != null ? c : new float[0];
            gains = g != null ? g : new float[0];
            inputGain = Math.min(0f, intent.getFloatExtra(EXTRA_INPUT_GAIN, 0f));
            applyEq();
        } else {
            turnOff();
        }
        if (!getStatus().on) {
            // stopSelfResult(startId): 이 명령 뒤에 새 명령(예: 다시 적용)이 이미 와 있으면 멈추지 않는다
            if (stopSelfResult(startId)) stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            updateNotification();
        }
        // START_STICKY: 메모리가 모자라 시스템이 서비스를 정리하면 나중에 다시 살려 준다(위의 복원으로 이어짐)
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        releaseAll();
        if (getStatus().on) publish(false, null, null, null);
        super.onDestroy();
    }

    // ---- EQ 걸기·끄기 ----

    private void applyEq() {
        if (cutoffs.length == 0 || cutoffs.length != gains.length) {
            releaseAll();
            saveLast(false);
            publish(false, null, null, "EQ 값이 올바르지 않습니다(밴드 수가 맞지 않음)");
            return;
        }
        try {
            // 켜져 있는 동안은 늘 신호를 받는다(고른 앱 방식에 쓰고, 고를 수 있는 앱 목록도 모은다)
            ensureReceiver();
            if (EqTargeting.useGlobal(targetMode)) {
                // ① 전체 출력: 이미 있으면 값만 바꾸고, 없으면 만들어 본다(안 되면 ② 앱 세션으로)
                globalEffect = globalEffect != null ? updateOrRecreate(globalEffect, 0) : tryCreateGlobal();
            } else if (globalEffect != null) {
                // ③ 고른 앱만: 전체 출력에 걸려 있으면 뗀다(안 그러면 고른 앱에 두 번 겹친다)
                globalEffect.release();
                globalEffect = null;
            }
            syncAllSessions();
            publish(true, name, modeLabel(), null);
            saveLast(true);
        } catch (Throwable t) {
            // 실패한 EQ가 "켜짐"으로 저장되어 나중에(재부팅 복원 등) 다시 걸리지 않게
            releaseAll();
            saveLast(false);
            publish(false, null, null, "EQ를 걸지 못했습니다: " + t.getMessage());
        }
    }

    /** 전체 출력(세션 0)에 걸어 본다. 막혀 있거나 다른 EQ 앱이 제어권을 쥐고 있으면 null */
    private DynamicsProcessing tryCreateGlobal() {
        try {
            DynamicsProcessing effect = createEffect(0);
            if (effect.hasControl()) return effect;
            effect.release();
        } catch (Throwable t) {
            // 이 폰에서 세션 0이 막혀 있음 → ② 방식으로
        }
        return null;
    }

    private String modeLabel() {
        if (globalEffect != null) return "global";
        return EqTargeting.APPS.equals(targetMode) ? "apps" : "sessions";
    }

    private void ensureReceiver() {
        if (receiverRegistered) return;
        IntentFilter filter = new IntentFilter();
        filter.addAction(AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION);
        filter.addAction(AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION);
        // 안드로이드 13부터는 다른 앱이 보내는 신호를 받으려면 RECEIVER_EXPORTED를 밝혀야 한다
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(sessionReceiver, filter, Context.RECEIVER_EXPORTED);
        else registerReceiver(sessionReceiver, filter);
        receiverRegistered = true;
    }

    /** 이 세션에 효과가 있어야 하면 붙이거나 값만 바꾸고, 없어야 하면 뗀다 */
    private void syncSession(int session, String pkg) {
        boolean want = EqTargeting.wantsSession(targetMode, globalEffect != null, targetApps, pkg);
        DynamicsProcessing effect = sessionEffects.get(session);
        try {
            if (want && effect == null) {
                while (sessionEffects.size() >= MAX_SESSIONS) {
                    Integer oldest = sessionEffects.keySet().iterator().next();
                    DynamicsProcessing old = sessionEffects.remove(oldest);
                    if (old != null) old.release();
                }
                sessionEffects.put(session, createEffect(session));
            } else if (want) {
                sessionEffects.put(session, updateOrRecreate(effect, session));
            } else if (effect != null) {
                sessionEffects.remove(session);
                effect.release();
            }
        } catch (Throwable t) {
            // 한 앱에 실패해도 다른 앱은 계속 시도한다(이미 닫힌 세션 등)
            DynamicsProcessing broken = sessionEffects.remove(session);
            if (broken != null) broken.release();
        }
    }

    private void syncAllSessions() {
        for (Map.Entry<Integer, String> e : new ArrayList<>(knownSessions.entrySet())) syncSession(e.getKey(), e.getValue());
    }

    /** 저장된 적용 대상(모든 앱/고른 앱)을 읽는다 */
    private void loadTargets() {
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        targetMode = EqTargeting.normalizeMode(p.getString(KEY_TARGET_MODE, EqTargeting.ALL));
        targetApps = EqTargeting.parseList(p.getString(KEY_TARGET_APPS, ""));
    }

    /** 신호를 보낸 앱을 기억한다(처음 본 앱이면 저장하고 앱 화면에 알린다) */
    private void rememberSeen(String pkg) {
        if (pkg == null || pkg.isEmpty() || pkg.equals(getPackageName())) return;
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        Set<String> seen = EqTargeting.parseList(p.getString(KEY_SEEN_APPS, ""));
        if (!seen.add(pkg)) return;
        p.edit().putString(KEY_SEEN_APPS, EqTargeting.joinList(seen)).apply();
        Status s = getStatus();
        publish(s.on, s.name, s.mode, s.error); // 상태는 그대로, 앱 화면이 목록을 다시 읽게
    }

    private void turnOff() {
        releaseAll();
        saveLast(false);
        publish(false, null, null, null);
    }

    private void releaseAll() {
        if (globalEffect != null) {
            globalEffect.release();
            globalEffect = null;
        }
        if (receiverRegistered) {
            unregisterReceiver(sessionReceiver);
            receiverRegistered = false;
        }
        for (DynamicsProcessing effect : sessionEffects.values()) effect.release();
        sessionEffects.clear();
        // 꺼져 있는 동안은 신호를 못 받아 닫힌 세션을 알 수 없으니 잊는다
        knownSessions.clear();
    }

    // ---- DynamicsProcessing ----

    private DynamicsProcessing.Eq makeEq() {
        DynamicsProcessing.Eq eq = new DynamicsProcessing.Eq(true, true, cutoffs.length);
        for (int i = 0; i < cutoffs.length; i++) {
            eq.setBand(i, new DynamicsProcessing.EqBand(true, cutoffs[i], gains[i]));
        }
        return eq;
    }

    private DynamicsProcessing createEffect(int session) {
        DynamicsProcessing.Config config = new DynamicsProcessing.Config.Builder(
                DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION,
                2, // 채널 수(스테레오)
                true, cutoffs.length, // 앞단 EQ 사용, 밴드 수
                false, 0, // 멀티밴드 압축 안 씀
                false, 0, // 뒷단 EQ 안 씀
                false // 리미터 안 씀
        ).build();
        config.setPreEqAllChannelsTo(makeEq());
        config.setInputGainAllChannelsTo(inputGain);
        DynamicsProcessing effect = new DynamicsProcessing(PRIORITY, session, config);
        effect.setEnabled(true);
        return effect;
    }

    /** 밴드 수가 같으면 값만 바꾸고(끊김 없음), 다르면 새로 만든다 */
    private DynamicsProcessing updateOrRecreate(DynamicsProcessing effect, int session) {
        if (effect.getConfig().getPreEqBandCount() == cutoffs.length) {
            effect.setPreEqAllChannelsTo(makeEq());
            effect.setInputGainAllChannelsTo(inputGain);
            return effect;
        }
        effect.release();
        return createEffect(session);
    }

    // ---- 저장 ----

    private void saveLast(boolean on) {
        SharedPreferences.Editor e = getSharedPreferences(PREFS, MODE_PRIVATE).edit();
        e.putBoolean("on", on);
        if (on) {
            e.putString("name", name);
            e.putString("cutoffs", join(cutoffs));
            e.putString("gains", join(gains));
            e.putFloat("inputGain", inputGain);
        }
        e.apply();
    }

    /** 저장해 둔 마지막 EQ를 읽는다. 꺼짐으로 저장됐거나 값이 망가졌으면 false */
    private boolean loadLast() {
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        if (!p.getBoolean("on", false)) return false;
        float[] c = split(p.getString("cutoffs", ""));
        float[] g = split(p.getString("gains", ""));
        if (c.length == 0 || c.length != g.length) return false;
        name = p.getString("name", "EQ");
        cutoffs = c;
        gains = g;
        inputGain = Math.min(0f, p.getFloat("inputGain", 0f));
        return true;
    }

    private static float[] split(String text) {
        if (text == null || text.isEmpty()) return new float[0];
        String[] parts = text.split(",");
        float[] out = new float[parts.length];
        try {
            for (int i = 0; i < parts.length; i++) out[i] = Float.parseFloat(parts[i]);
        } catch (NumberFormatException e) {
            return new float[0];
        }
        return out;
    }

    private static String join(float[] values) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < values.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(values[i]);
        }
        return sb.toString();
    }

    // ---- 알림 ----

    private void startInForeground() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                    new NotificationChannel(CHANNEL_ID, "폰 전체 EQ", NotificationManager.IMPORTANCE_LOW));
        }
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void updateNotification() {
        getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, buildNotification());
    }

    private Notification buildNotification() {
        PendingIntent open = PendingIntent.getActivity(
                this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent off = PendingIntent.getService(
                this, 1, new Intent(this, SystemEqService.class).setAction(ACTION_OFF), PendingIntent.FLAG_IMMUTABLE);
        Status s = getStatus();
        String text;
        if (!s.on) text = "준비 중";
        else if ("apps".equals(s.mode)) text = "고른 앱에 적용 중";
        else if ("sessions".equals(s.mode)) text = "재생 앱 신호 방식으로 적용 중";
        else text = "폰 전체 소리에 적용 중";
        return new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle(s.on && s.name != null ? "EQ: " + s.name : "EQ")
                .setContentText(text)
                .setContentIntent(open)
                .addAction(new Notification.Action.Builder(
                        Icon.createWithResource(this, android.R.drawable.ic_menu_close_clear_cancel), "끄기", off).build())
                .setOngoing(true)
                .build();
    }
}
