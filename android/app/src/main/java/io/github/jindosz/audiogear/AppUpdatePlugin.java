package io.github.jindosz.audiogear;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 앱 업데이트(웹 화면 src/appUpdate.ts에서 registerPlugin('AppUpdate')로 부름).
 * GitHub Releases의 새 APK를 앱 안에서 받아 안드로이드 설치 화면을 띄운다.
 * 파일로 설치한 앱은 몰래 설치할 수 없어서, 사용자가 설치 화면에서 [설치]를 한 번 눌러야 한다.
 * - canInstall: 이 앱이 다른 APK 설치를 요청해도 되는지(설정 → "이 출처 허용")
 * - openInstallSettings: 그 설정 화면 열기
 * - downloadAndInstall: 받고(진행률은 "downloadProgress" 이벤트) 설치 화면 열기
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        // 안드로이드 8(API 26) 아래는 앱별 허용이 없고 "알 수 없는 출처" 하나로 정해서 늘 true로 본다
        boolean allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.O
                || getContext().getPackageManager().canRequestPackageInstalls();
        result.put("allowed", allowed);
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve();
            return;
        }
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                .setData(Uri.parse("package:" + getContext().getPackageName()))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName", "update.apk");
        if (url == null || !url.startsWith("https://")) {
            call.reject("업데이트 주소가 올바르지 않아요");
            return;
        }
        // 받기는 시간이 걸려서 화면(메인) 스레드가 아닌 다른 스레드에서 한다
        new Thread(() -> {
            try {
                File apk = download(url, fileName);
                openInstaller(apk);
                call.resolve();
            } catch (Exception e) {
                call.reject("업데이트를 받지 못했어요: " + e.getMessage());
            }
        }).start();
    }

    /** 앱 캐시 폴더의 updates/에 받는다. 예전에 받아 둔 APK는 먼저 지운다 */
    private File download(String address, String fileName) throws Exception {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("저장할 폴더를 만들지 못했어요");
        File[] old = dir.listFiles();
        if (old != null) for (File f : old) f.delete();
        File target = new File(dir, fileName);

        // GitHub는 다른 주소(파일 저장소)로 넘겨주므로(redirect) 따라간다
        HttpURLConnection conn = (HttpURLConnection) new URL(address).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        int code = conn.getResponseCode();
        if (code != 200) throw new Exception("HTTP " + code);
        long total = conn.getContentLengthLong();
        try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(target)) {
            byte[] buffer = new byte[64 * 1024];
            long done = 0;
            int lastPercent = -1;
            int n;
            while ((n = in.read(buffer)) != -1) {
                out.write(buffer, 0, n);
                done += n;
                if (total > 0) {
                    int percent = (int) (done * 100 / total);
                    if (percent != lastPercent) {
                        lastPercent = percent;
                        JSObject progress = new JSObject();
                        progress.put("percent", percent);
                        notifyListeners("downloadProgress", progress);
                    }
                }
            }
        } finally {
            conn.disconnect();
        }
        return target;
    }

    /** 안드로이드 설치 화면 열기. 파일은 FileProvider(AndroidManifest의 provider, res/xml/file_paths.xml)로 건넨다 */
    private void openInstaller(File apk) {
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }
}
