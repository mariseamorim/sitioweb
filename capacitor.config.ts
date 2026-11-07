import type { CapacitorConfig } from '@capacitor/cli'

// App Android nativo (WebView) que abre o site ao vivo. Substitui o TWA do PWA Builder: não depende do Chrome, não
// mostra barra de endereço nem o aviso "Executando no Chrome", e não precisa de verificação do assetlinks.
// Mesmo pacote e mesma chave de envio da Play Store (keystore da pasta "(1)" em Downloads; ver android/keystore.properties.example).
const SITE = 'https://www.anotaaiagro.com.br'

const config: CapacitorConfig = {
  appId: 'br.com.anotaaiagro.app',
  appName: 'Anota Aí Agro',
  // Só a tela "Abrindo…" fica no pacote; o conteúdo vem de `server.url`.
  webDir: 'capacitor/www',
  server: {
    url: SITE,
    // Endereços que abrem dentro do app. O login com Google passa por accounts.google.com e volta para o site;
    // tudo o mais (links externos, WhatsApp) abre no navegador ou no app correspondente.
    allowNavigation: ['www.anotaaiagro.com.br', 'anotaaiagro.com.br', 'accounts.google.com', '*.google.com', '*.googleusercontent.com'],
  },
  android: {
    backgroundColor: '#0f3f2e',
    allowMixedContent: false,
    // Zoom de pinça liberado: o texto do app fica em 100% (MainActivity.java) e esta é a forma de ampliar.
    zoomEnabled: true,
    // Os pedidos do service worker do site vão direto à rede, sem passar pelo Capacitor (que os refaria por conta
    // própria e sem internet falharia). Junto com o WebViewClient em MainActivity.java, deixa o offline igual ao do Chrome.
    resolveServiceWorkerRequests: false,
    // O Google recusa login em WebView (erro "disallowed_useragent") quando o identificador traz "; wv".
    // Usa o identificador de um Chrome comum para o fluxo de login funcionar dentro do app.
    overrideUserAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 AnotaAiAgro/Android',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: '#0f3f2e' },
    // O site usa viewport-fit=cover e reserva o espaço da barra de status via CSS (classe app-android em layout.tsx).
    // Fundo das telas é claro: ícones escuros na barra de status ("LIGHT"), sem seguir o tema do aparelho.
    SystemBars: { style: 'LIGHT', initialViewportFitValueHint: 'cover' },
  },
}

export default config
