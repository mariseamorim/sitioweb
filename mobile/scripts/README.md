# Compilar o app Android

1. `npm install` (uma vez).
2. `npx expo prebuild --platform android --clean` gera a pasta `android/` (fora do git).
3. `node scripts/assinatura.js` liga a assinatura de release à chave da loja (precisa de `android/keystore.properties`, copiado de `keystore.properties.example`).
   `node scripts/windows.js` manda o build C++ para `D:/x` (o Windows limita caminhos a 260 caracteres). Compile a partir do atalho curto
   `D:m` (criado uma vez com `mklink /J D:m C:sitiowebmobile`, no cmd): `cd D:mandroid`.
4. Teste no celular: `cd android && gradlew.bat assembleRelease` → `android/app/build/outputs/apk/release/app-release.apk`.
5. Loja: `cd android && gradlew.bat bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`.

Precisa de JDK 21 (`%USERPROFILE%\.gradle\gradle.properties` aponta `org.gradle.java.home`) e do Android SDK (`ANDROID_HOME`).
A versão para a loja fica em `app.json` (`android.versionCode`, sempre maior que a anterior).
