package com.hideyukikumura.cardvalia;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Android 15（targetSdkVersion 35）以降はOSがアプリを強制的にエッジトゥエッジ表示にするため、
        // 独自コードで無効化することはできない。Google公式のEdgeToEdge APIに任せることで、
        // OSバージョンごとのインセット処理の差異を正しく吸収してもらう
        // （Play Consoleの事前起動レポートで指摘された「非推奨API使用」
        // 「一部端末でエッジトゥエッジが正しく有効にならない」を解消するため）。
        // 一般的にはsuper.onCreate()より前に呼ぶのが推奨されるが、BridgeActivity（AppCompatActivity）では
        // super.onCreate()内のAppCompat初期化処理が先に走らないと設定が反映されなかったため、後に呼ぶ
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT));
    }
}
