package br.com.anotaaiagro.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // O WebView amplia o texto conforme o tamanho de fonte do Android, e com fonte grande os botões e as tabelas do
        // site quebram (palavras partidas, colunas fora da tela). O app fixa o texto em 100%, como os apps nativos da
        // loja; quem precisa de letras maiores usa o zoom de pinça (zoomEnabled em capacitor.config.ts).
        getBridge().getWebView().getSettings().setTextZoom(100);
    }
}
