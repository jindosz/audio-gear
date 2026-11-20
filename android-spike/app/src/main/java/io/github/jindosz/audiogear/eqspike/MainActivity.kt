package io.github.jindosz.audiogear.eqspike

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.media.audiofx.AudioEffect
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowInsets
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/**
 * 시험 앱 화면. 디자인 없이 버튼 몇 개와 기록(로그)만 보여준다.
 * 화면 부품을 XML 대신 코드로 만들어서 파일 수를 줄였다.
 */
class MainActivity : Activity() {

    private lateinit var status: TextView
    private lateinit var logView: TextView
    private lateinit var globalButton: Button
    private lateinit var sessionsButton: Button
    private lateinit var bandsButton: Button
    private lateinit var stressButton: Button
    private val handler = Handler(Looper.getMainLooper())

    // 1초마다 서비스 상태와 기록을 다시 읽어 화면에 보여준다
    private val tick = object : Runnable {
        override fun run() {
            refresh()
            handler.postDelayed(this, 1000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 안드로이드 13부터 알림을 띄우려면 허락을 받아야 한다(거절해도 EQ 시험은 된다)
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), 1)
        }

        val pad = dp(16)
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
        }
        column.addView(TextView(this).apply {
            text = "EQ 시험 앱"
            textSize = 22f
            setTypeface(typeface, Typeface.BOLD)
        })
        column.addView(TextView(this).apply {
            text = "①② 버튼은 저음을 크게 깎고 음량을 낮춘 EQ, ③은 실제 앱과 같은 127밴드 EQ(저음 깎기 + 3kHz 골)를 겁니다. " +
                "스포티파이에서 곡을 틀어 둔 채로 켜고 끄며 소리가 바뀌는지 들어 보세요.\n" +
                "시험 전에 Wavelet과 삼성 사운드의 이퀄라이저·Dolby Atmos는 꺼 두세요."
            setPadding(0, dp(8), 0, dp(8))
        })
        status = TextView(this).apply { setPadding(0, dp(4), 0, dp(8)) }
        column.addView(status)

        globalButton = button { send(if (EqService.globalOn) EqService.ACTION_GLOBAL_OFF else EqService.ACTION_GLOBAL_ON) }
        sessionsButton = button { send(if (EqService.sessionsOn) EqService.ACTION_SESSIONS_OFF else EqService.ACTION_SESSIONS_ON) }
        bandsButton = button { send(if (EqService.bands127On) EqService.ACTION_ALL_OFF else EqService.ACTION_BANDS127_ON) }
        stressButton = button { send(if (EqService.stressOn) EqService.ACTION_STRESS_OFF else EqService.ACTION_STRESS_ON) }
        column.addView(globalButton)
        column.addView(sessionsButton)
        column.addView(bandsButton)
        column.addView(stressButton)
        column.addView(button("모두 끄기") { send(EqService.ACTION_ALL_OFF) })

        column.addView(TextView(this).apply {
            text = "기록 (최신이 위)"
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, dp(16), 0, dp(4))
        })
        logView = TextView(this).apply {
            typeface = Typeface.MONOSPACE
            textSize = 12f
            setTextIsSelectable(true) // 길게 눌러 복사해서 보내 줄 수 있게
        }
        column.addView(logView)

        val scroll = ScrollView(this).apply { addView(column) }
        // 안드로이드 15부터 앱 화면이 상태 표시줄 밑까지 그려지므로, 그만큼 여백을 더한다
        scroll.setOnApplyWindowInsetsListener { v, insets ->
            val top: Int
            val bottom: Int
            if (Build.VERSION.SDK_INT >= 30) {
                val bars = insets.getInsets(WindowInsets.Type.systemBars())
                top = bars.top
                bottom = bars.bottom
            } else {
                @Suppress("DEPRECATION")
                top = insets.systemWindowInsetTop
                @Suppress("DEPRECATION")
                bottom = insets.systemWindowInsetBottom
            }
            v.setPadding(0, top, 0, bottom)
            insets
        }
        setContentView(scroll)

        logDeviceInfo()
    }

    override fun onResume() {
        super.onResume()
        handler.post(tick)
    }

    override fun onPause() {
        handler.removeCallbacks(tick)
        super.onPause()
    }

    private fun refresh() {
        val apps = synchronized(EqService.attached) { EqService.attached.values.toList() }
        status.text = "① 전체 출력: ${onOff(EqService.globalOn)}\n" +
            "③ 127밴드: ${onOff(EqService.bands127On)}${if (EqService.stressOn) " · ④ 실시간 변경 중" else ""}\n" +
            "② 앱 신호 받기: ${onOff(EqService.sessionsOn)}" +
            (if (apps.isNotEmpty()) " · EQ 걸린 앱: ${apps.joinToString()}" else "")
        globalButton.text = if (EqService.globalOn) "① 전체 출력 EQ 끄기" else "① 전체 출력에 EQ 걸기 (세션 0)"
        sessionsButton.text = if (EqService.sessionsOn) "② 앱 신호 받기 끄기" else "② 앱 신호 받기 (세션별)"
        bandsButton.text = if (EqService.bands127On) "③ 127밴드 EQ 끄기" else "③ 127밴드 EQ 걸기 (실제 앱 방식)"
        stressButton.text = if (EqService.stressOn) "④ 실시간 변경 시험 멈추기" else "④ 실시간 변경 시험 (0.3초마다 바뀜)"
        logView.text = EqService.logText()
    }

    /** 이 폰이 DynamicsProcessing 효과를 갖고 있는지 등 기본 정보를 기록에 남긴다 */
    private fun logDeviceInfo() {
        val effects = try {
            AudioEffect.queryEffects().orEmpty()
        } catch (t: Throwable) {
            EqService.log("효과 목록 읽기 실패: ${t.message}")
            emptyArray()
        }
        val hasDp = effects.any { it.type == AudioEffect.EFFECT_TYPE_DYNAMICS_PROCESSING }
        EqService.log(
            "기기: ${Build.MANUFACTURER} ${Build.MODEL} · 안드로이드 ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT}) · " +
                "효과 ${effects.size}개 · DynamicsProcessing ${if (hasDp) "있음" else "없음"}",
        )
    }

    private fun send(action: String) {
        startForegroundService(Intent(this, EqService::class.java).setAction(action))
        handler.postDelayed({ refresh() }, 300)
    }

    private fun button(label: String = "", onClick: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        setOnClickListener { onClick() }
    }

    private fun onOff(on: Boolean) = if (on) "켜짐" else "꺼짐"

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
