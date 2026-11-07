# Compilar o app Android

1. `npm install` (uma vez).
2. `npx expo prebuild --platform android --clean` gera a pasta `android/` (fora do git).
3. `node scripts/assinatura.js` liga a assinatura de release à chave da loja (precisa de `android/keystore.properties`, copiado de `keystore.properties.example`).
   `node scripts/windows.js` manda o build C++ para `D:/x` e usa o CMake 3.31 do SDK com o ninja 1.13 de `D:/dev/ninja`
   (o Windows limita caminhos a 260 caracteres e o ninja do SDK não aceita caminhos longos).
4. Teste no celular: `cd android && gradlew.bat assembleRelease` → `android/app/build/outputs/apk/release/app-release.apk`.
   Em `android/gradle.properties`, `reactNativeArchitectures=arm64-v8a` (só a arquitetura dos celulares atuais, para a máquina de 8 GB
   aguentar) e `org.gradle.workers.max=2`. Para a loja, inclua também `armeabi-v7a` se quiser atender celulares bem antigos.
5. Loja: `cd android && gradlew.bat bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`.

Precisa de JDK 21 (`%USERPROFILE%\.gradle\gradle.properties` aponta `org.gradle.java.home`) e do Android SDK (`ANDROID_HOME`).
A versão para a loja fica em `app.json` (`android.versionCode`, sempre maior que a anterior).
