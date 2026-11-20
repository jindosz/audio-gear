package io.github.jindosz.audiogear;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 이 앱에서 직접 만든 플러그인은 super.onCreate 전에 등록해야 웹 화면에서 부를 수 있다
        registerPlugin(SystemEqPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
