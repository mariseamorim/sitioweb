// Depois do `expo prebuild`, liga a assinatura de release à chave de envio da Play Store.
// Os dados ficam em mobile/android/keystore.properties (fora do git; modelo em keystore.properties.example).
// Sem o arquivo, o release continua assinado com a chave de depuração (serve para testar, não para a loja).
const fs = require('fs')
const path = require('path')
const gradle = path.join(__dirname, '..', 'android', 'app', 'build.gradle')
let s = fs.readFileSync(gradle, 'utf8')
if (s.includes('keystoreProperties')) { console.log('assinatura já configurada'); process.exit(0) }
s = s.replace(/android \{\n/, `def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('keystore.properties')
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.withInputStream { keystoreProperties.load(it) }
}

android {
`)
s = s.replace(/signingConfigs \{\n        debug \{/, `signingConfigs {
        release {
            if (keystoreProperties['storeFile']) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
        debug {`)
// o buildType release usa signingConfigs.debug por padrão; troca pela chave da loja quando ela existe.
// Ancorado no comentário do próprio bloco: um regex em "release {" pegava o signingConfigs.release recém-criado
// e acabava alterando o buildType debug (o .aab saía com a chave de depuração).
const antes = s
s = s.replace(/(signed-apk-android\.\n\s*)signingConfig signingConfigs\.debug/, `$1signingConfig keystoreProperties['storeFile'] ? signingConfigs.release : signingConfigs.debug`)
if (s === antes) { console.error('não achei o signingConfig do buildType release em', gradle); process.exit(1) }
fs.writeFileSync(gradle, s)
console.log('assinatura de release configurada em', gradle)
