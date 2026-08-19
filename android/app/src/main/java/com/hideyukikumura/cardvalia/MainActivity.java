package com.hideyukikumura.cardvalia;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // エッジトゥエッジ表示：ステータスバー／ジェスチャーバーの背景を透過にし、
        // アプリの背景の上に時計・バッテリー等のアイコンだけが重なって見えるようにする
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        // アプリの背景が濃色のため、バーのアイコンは白系（ライトでない）にする
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);

        // Android 10以降は透過バーの視認性確保のため、デフォルトで半透明の網掛け（コントラスト強制）が
        // 自動的に重なる。これがナビゲーションバーだけ白っぽく残って見える原因のため無効化する
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }
}
