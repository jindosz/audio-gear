package io.github.jindosz.audiogear.eqspike

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.media.audiofx.AudioEffect
import android.media.audiofx.DynamicsProcessing
import android.os.Build
import android.os.IBinder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 시험용 EQ 서비스.
 * "포그라운드 서비스"는 화면을 닫아도 계속 살아 있는 앱 부품이다(알림이 하나 떠 있음).
 * EQ 효과 객체를 여기서 들고 있어야 화면을 닫아도 EQ가 풀리지 않는다.
 *
 * 두 가지 방식을 시험한다.
 *  ① 전체 출력(세션 0)에 EQ 걸기: 폰에서 나는 모든 소리에 한 번에 건다. 안드로이드가 오래전부터 "비추천"으로 둔 방식이라 폰마다 될 수도, 안 될 수도 있다.
 *  ② 앱 신호 받기: 스포티파이 같은 재생 앱이 재생을 시작할 때 보내는 "오디오 세션 열림" 신호를 받아, 그 앱 소리에만 EQ를 건다(Wavelet도 쓰는 방식).
 */
class EqService : Service() {

    companion object {
        const val ACTION_GLOBAL_ON = "eqspike.GLOBAL_ON"
        const val ACTION_GLOBAL_OFF = "eqspike.GLOBAL_OFF"
        const val ACTION_SESSIONS_ON = "eqspike.SESSIONS_ON"
        const val ACTION_SESSIONS_OFF = "eqspike.SESSIONS_OFF"
        const val ACTION_ALL_OFF = "eqspike.ALL_OFF"

        private const val CHANNEL_ID = "eq"
        private const val NOTIFICATION_ID = 1

        /** 효과끼리 경쟁할 때 우선순위. 높을수록 이긴다 */
        private const val PRIORITY = Int.MAX_VALUE

        /**
         * 시험용 EQ: 확실히 티가 나게 저음을 크게 깎고 전체 음량도 낮춘다.
         * 밴드 값은 (그 밴드의 위쪽 끝 주파수 Hz, 게인 dB). 켜는 순간 "얇고 작은 소리"가 되면 성공
         */
        private val TEST_BANDS = listOf(150f to -20f, 500f to -10f, 20000f to 0f)
        private const val TEST_INPUT_GAIN_DB = -10f

        // 화면(MainActivity)이 1초마다 읽어 가는 상태. 같은 앱 안이라 이렇게 공유해도 된다
        @Volatile var globalOn = false
        @Volatile var sessionsOn = false
        val attached = linkedMapOf<Int, String>() // 세션 번호 → 앱 이름

        private val logLines = ArrayDeque<String>()
        private val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.KOREA)

        fun log(msg: String) = synchronized(logLines) {
            logLines.addFirst("${timeFormat.format(Date())}  $msg")
            while (logLines.size > 200) logLines.removeLast()
        }

        fun logText(): String = synchronized(logLines) { logLines.joinToString("\n") }
    }

    private var globalEffect: DynamicsProcessing? = null
    private val sessionEffects = HashMap<Int, DynamicsProcessing>()
    private var receiverRegistered = false

    /** 재생 앱이 보내는 "오디오 세션 열림/닫힘" 신호를 받는 곳 */
    private val sessionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val session = intent.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, AudioEffect.ERROR_BAD_VALUE)
            val pkg = intent.getStringExtra(AudioEffect.EXTRA_PACKAGE_NAME) ?: "(앱 이름 없음)"
            when (intent.action) {
                AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION -> attachSession(session, pkg)
                AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION -> detachSession(session, pkg)
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // startForegroundService로 불렀으면 5초 안에 알림을 띄워야 해서, 무슨 명령이든 먼저 띄운다
        startInForeground()
        when (intent?.action) {
            ACTION_GLOBAL_ON -> globalOn()
            ACTION_GLOBAL_OFF -> globalOff()
            ACTION_SESSIONS_ON -> sessionsOn()
            ACTION_SESSIONS_OFF -> sessionsOff()
            ACTION_ALL_OFF -> {
                globalOff()
                sessionsOff()
            }
        }
        if (!globalOn && !sessionsOn) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        } else {
            updateNotification()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        globalOff()
        sessionsOff()
        super.onDestroy()
    }

    // ---- ① 전체 출력(세션 0) ----

    private fun globalOn() {
        if (globalEffect != null) return
        try {
            val effect = makeEffect(0, "전체 출력")
            globalEffect = effect
            globalOn = true
            log("① 전체 출력에 EQ를 걸었습니다. 제어권: ${if (effect.hasControl()) "있음" else "없음(다른 EQ 앱이 쥐고 있음)"}")
        } catch (t: Throwable) {
            log("① 전체 출력 실패: ${t.javaClass.simpleName}: ${t.message}")
        }
    }

    private fun globalOff() {
        globalEffect?.let {
            it.release()
            log("① 전체 출력 EQ를 껐습니다")
        }
        globalEffect = null
        globalOn = false
    }

    // ---- ② 앱 신호 받기(세션별) ----

    private fun sessionsOn() {
        if (receiverRegistered) return
        val filter = IntentFilter().apply {
            addAction(AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION)
            addAction(AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION)
        }
        // 안드로이드 13부터는 다른 앱이 보내는 신호를 받으려면 RECEIVER_EXPORTED를 밝혀야 한다
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(sessionReceiver, filter, Context.RECEIVER_EXPORTED)
        else registerReceiver(sessionReceiver, filter)
        receiverRegistered = true
        sessionsOn = true
        log("② 앱 신호 받기 시작. 이제 스포티파이에서 곡을 재생(또는 일시정지 후 다시 재생)해 보세요")
    }

    private fun sessionsOff() {
        if (receiverRegistered) {
            unregisterReceiver(sessionReceiver)
            receiverRegistered = false
            log("② 앱 신호 받기를 껐습니다")
        }
        sessionEffects.values.forEach { it.release() }
        sessionEffects.clear()
        synchronized(attached) { attached.clear() }
        sessionsOn = false
    }

    private fun attachSession(session: Int, pkg: String) {
        log("② 신호 받음: 열림 · $pkg · 세션 $session")
        if (session == AudioEffect.ERROR_BAD_VALUE || sessionEffects.containsKey(session)) return
        try {
            val effect = makeEffect(session, pkg)
            sessionEffects[session] = effect
            synchronized(attached) { attached[session] = pkg }
            log("② $pkg 소리에 EQ를 걸었습니다. 제어권: ${if (effect.hasControl()) "있음" else "없음"}")
        } catch (t: Throwable) {
            log("② $pkg 실패: ${t.javaClass.simpleName}: ${t.message}")
        }
        updateNotification()
    }

    private fun detachSession(session: Int, pkg: String) {
        log("② 신호 받음: 닫힘 · $pkg · 세션 $session")
        sessionEffects.remove(session)?.release()
        synchronized(attached) { attached.remove(session) }
        updateNotification()
    }

    // ---- EQ 효과 만들기 ----

    /**
     * DynamicsProcessing: 안드로이드 9부터 있는 기본 오디오 효과. 밴드 수와 주파수를 자유롭게 정할 수 있어
     * 나중에 이 앱의 PEQ를 옮겨 오기에 맞다. 여기서는 그중 "앞단 EQ(preEq)"와 입력 음량만 쓴다
     */
    private fun makeEffect(session: Int, label: String): DynamicsProcessing {
        val config = DynamicsProcessing.Config.Builder(
            DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION,
            2, // 채널 수(스테레오)
            true, TEST_BANDS.size, // 앞단 EQ 사용, 밴드 수
            false, 0, // 멀티밴드 압축 안 씀
            false, 0, // 뒷단 EQ 안 씀
            false, // 리미터 안 씀
        ).build()
        val eq = DynamicsProcessing.Eq(true, true, TEST_BANDS.size)
        TEST_BANDS.forEachIndexed { i, (cutoff, gain) -> eq.setBand(i, DynamicsProcessing.EqBand(true, cutoff, gain)) }
        config.setPreEqAllChannelsTo(eq)
        config.setInputGainAllChannelsTo(TEST_INPUT_GAIN_DB)

        val effect = DynamicsProcessing(PRIORITY, session, config)
        effect.setControlStatusListener { _, granted ->
            log("$label: 제어권 ${if (granted) "되찾음" else "빼앗김(다른 EQ 앱이 가져감)"}")
        }
        val status = effect.setEnabled(true)
        if (status != AudioEffect.SUCCESS) log("$label: 켜기 결과 코드 $status (0이 아니면 실패)")
        return effect
    }

    // ---- 알림 ----

    private fun startInForeground() {
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "EQ 켜짐", NotificationManager.IMPORTANCE_LOW))
        }
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun updateNotification() {
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification())
    }

    private fun buildNotification(): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val parts = buildList {
            if (globalOn) add("전체 출력")
            if (sessionsOn) add("앱 ${synchronized(attached) { attached.size }}개")
        }
        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("EQ 시험 켜짐")
            .setContentText(if (parts.isEmpty()) "준비 중" else parts.joinToString(" · "))
            .setContentIntent(open)
            .setOngoing(true)
            .build()
    }
}
