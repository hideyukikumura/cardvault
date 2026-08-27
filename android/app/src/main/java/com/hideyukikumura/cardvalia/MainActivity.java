package com.hideyukikumura.cardvalia;

import android.graphics.Color;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // エッジトゥエッジは使用しない：パンチホールカメラ付き端末で、中央寄せのヘッダー文言等が
        // カメラ穴と重なる問題があったため、OSに標準のステータスバー／ジェスチャーバー領域を
        // 確保させる（システムがカメラの穴を含む高さを自動的に避けてくれる）。
        // その上で、アプリのダークテーマに合わせてバーの色とアイコンの明暗だけ調整する。
        getWindow().setStatusBarColor(Color.parseColor("#090d16"));
        getWindow().setNavigationBarColor(Color.parseColor("#090d16"));

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
    }
}
