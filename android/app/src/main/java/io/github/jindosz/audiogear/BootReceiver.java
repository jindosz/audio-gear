package io.github.jindosz.audiogear;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * 폰을 다시 켜면(부팅 완료) 마지막으로 켜 두었던 폰 전체 EQ를 다시 건다.
 * 꺼 둔 상태였으면 서비스가 저장값을 보고 아무것도 하지 않고 멈춘다(SystemEqService의 ACTION_RESTORE).
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        boolean on = context.getSharedPreferences(SystemEqService.PREFS, Context.MODE_PRIVATE).getBoolean("on", false);
        if (!on) return; // 꺼 둔 상태면 서비스도 띄우지 않는다
        context.startForegroundService(
                new Intent(context, SystemEqService.class).setAction(SystemEqService.ACTION_RESTORE));
    }
}
