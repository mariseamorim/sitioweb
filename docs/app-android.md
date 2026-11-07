# App Android (Capacitor)

O app da Play Store é um app Android nativo que abre o site `https://www.anotaaiagro.com.br` dentro de um WebView
(pasta `android/`, gerada pelo Capacitor). Ele substitui o TWA feito no PWA Builder: não depende do Chrome, não mostra
barra de endereço nem o aviso "Executando no Chrome" e não precisa da verificação do `assetlinks.json`.

- Pacote: `br.com.anotaaiagro.app` (o mesmo já registrado na loja).
- Chave de envio: o `signing.keystore` da pasta `Downloads\___ - Google Play package (1)`. Dados em `android/keystore.properties`
  (copie de `android/keystore.properties.example`; o arquivo fica fora do git).
- Versão: `versionCode` em `android/app/build.gradle`. A loja recebeu o 1 (TWA); cada envio novo precisa de um número maior.
- Configuração: `capacitor.config.ts` (endereço do site, hosts permitidos, identificador do navegador para o login com Google).
- Ícones e tela de abertura: gerados de `capacitor/assets/` com `npx capacitor-assets generate --android --assetPath capacitor/assets`.

## O que precisa na máquina

- JDK 17 (já instalado em `C:\Program Files\Java\jdk-17`).
- Android SDK: Android Studio ou só as "command line tools", com `platforms;android-36`, `build-tools;36.0.0` e `platform-tools`.
  O caminho do SDK vai em `android/local.properties` (`sdk.dir=C:/Users/Admin/AppData/Local/Android/Sdk`).

## Gerar o pacote para a loja

```
npm run android:bundle
```

Sai em `android/app/build/outputs/bundle/release/app-release.aab`. Envie no Play Console como uma versão nova.
Para instalar direto no celular (teste), `npm run android:apk` gera `android/app/build/outputs/apk/release/app-release-unsigned.apk`
assinado se o `keystore.properties` existir.

## Como o site se comporta dentro do app

- Login com Google: o Google recusa WebView comum; o app se identifica como Chrome (`overrideUserAgent`) e o fluxo
  acontece dentro do app, voltando para o site com a sessão.
- Falar o número: o WebView não tem reconhecimento de voz do navegador; o site cai no pacote de voz offline (Vosk).
- Microfone e câmera: o Capacitor pede a permissão do Android na primeira vez que o site usa.
- Links externos (WhatsApp, outros sites) abrem fora do app. Só os hosts de `allowNavigation` ficam dentro.
