package br.com.anotaaiagro.app;

import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // O WebView amplia o texto conforme o tamanho de fonte do Android, e com fonte grande os botões e as tabelas do
        // site quebram (palavras partidas, colunas fora da tela). O app fixa o texto em 100%, como os apps nativos da
        // loja; quem precisa de letras maiores usa o zoom de pinça (zoomEnabled em capacitor.config.ts).
        getBridge().getWebView().getSettings().setTextZoom(100);

        // Com `server.url`, o Capacitor busca cada página HTML por conta própria (HttpURLConnection) para injetar o
        // script da ponte nativa. Isso passa por fora do service worker e do cache do WebView: sem internet a tela não
        // abre, e as respostas chegam sem os cabeçalhos originais (Cache-Control etc.), o que mistura versões ao navegar
        // rápido. O site não usa a ponte nativa, então o app deixa o WebView (e o service worker do site) cuidar de
        // todos os pedidos, exatamente como no Chrome. shouldOverrideUrlLoading continua o do Capacitor (links
        // externos abrem fora do app).
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return null;
            }
        });
    }
}
