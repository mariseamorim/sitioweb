# App Android

Há dois projetos de app Android no repositório. O que vale é o **React Native (Expo)**, em `mobile/`.

## mobile/ — React Native (Expo), com banco local e sincronismo

- Pasta `mobile/` (não pode se chamar `app/`: o Next.js trataria como as rotas do site).
- Pacote `br.com.anotaaiagro.app` (o mesmo da loja), versão em `mobile/app.json` (`android.versionCode`, sempre maior que a anterior).
- Banco local SQLite (`expo-sqlite`) com cópia dos dados da propriedade: animais, leite, vacinas, tratamentos, financeiro,
  estoque e movimentações, mais a fila de envio (`outbox`).
- **Sincronismo** (`mobile/src/sync/`): ao abrir, ao voltar a internet e ao trazer o app para frente. Primeiro envia a fila na
  ordem pelas rotas `/api/*` existentes (POST/PUT/DELETE), trocando ids temporários `local_<uuid>` pelos definitivos; só então
  baixa as listas (GET) e substitui a cópia local. Envio recusado pelo servidor (4xx) fica marcado em Mais › Sincronização,
  onde a pessoa descarta ou tenta de novo.
- **Sessão sem cookies:** o app manda `X-Anota-Client: mobile` e recebe o token no corpo do login e de `/api/auth/me`;
  depois envia `Authorization: Bearer <token>`. Admin manda a propriedade aberta em `X-Active-Farm` (ver `src/lib/auth.ts`).
- Login só com e-mail/telefone e senha. Conta e login com Google continuam pelo site.
- Como compilar: `mobile/scripts/README.md`. Resumo: `npx expo prebuild --platform android --clean`, `node scripts/assinatura.js`,
  `cd android && gradlew.bat assembleRelease` (teste) ou `bundleRelease` (loja, com `android/keystore.properties`).

## android/ — Capacitor (abandonado)

Primeira tentativa: o site dentro de um WebView. Ficou com problemas de offline e de layout (fonte do sistema). Mantido só
até o app Expo ser validado; depois pode ser apagado junto com `capacitor.config.ts`, `capacitor/` e as dependências `@capacitor/*`.

## O que precisa na máquina

- JDK 21 em `C:\Users\Admin\AppData\Local\Programs\jdk-21`, apontado em `%USERPROFILE%\.gradle\gradle.properties` por `org.gradle.java.home`.
- Android SDK em `C:\Users\Admin\AppData\Local\Android\Sdk` (platform-tools, platforms;android-36, build-tools). `ANDROID_HOME` ou `android/local.properties`.
- Chave de envio da loja: `signing.keystore` da pasta `Downloads\___ - Google Play package (1)`; senhas no `signing-key-info.txt` dela.
