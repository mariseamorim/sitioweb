// Windows limita caminhos a 260 caracteres e a compilação nativa (CMake/ninja) do React Native estoura esse limite,
// mesmo com LongPathsEnabled=1: o ninja 1.10 que vem com o CMake do Android SDK não usa caminhos longos.
// Depois do `expo prebuild`, este script:
//  - manda os arquivos intermediários do C++ para uma pasta curta (D:/x);
//  - usa o CMake 3.31 do SDK (`sdkmanager "cmake;3.31.0"`) com um ninja 1.13 avulso em D:/dev/ninja/ninja.exe
//    (instalado com `winget install Ninja-build.Ninja` e copiado para lá), que aceita caminhos longos;
//  - recria local.properties (SDK em D:) e deixa gradle.properties leve para a máquina de 8 GB.
// Não use um atalho (mklink /J) para encurtar o caminho do projeto: o empacotador do JavaScript exige o caminho real.
const fs = require('fs')
const path = require('path')
const androidDir = path.join(__dirname, '..', 'android')
const gradle = path.join(androidDir, 'app', 'build.gradle')
const MARK = 'ver scripts/windows.js'
const ANDROID_BLOCK = `    // Caminho curto para o build C++ (limite de 260 caracteres do Windows); ${MARK}
    externalNativeBuild { cmake { buildStagingDirectory "D:/x"; version "3.31.0" } }
`
const DEFAULT_BLOCK = `        // ninja com caminhos longos; ${MARK}
        externalNativeBuild { cmake { arguments "-DCMAKE_MAKE_PROGRAM=D:/dev/ninja/ninja-j3.bat" } }
`
let s = fs.readFileSync(gradle, 'utf8')
// remove o que uma execução anterior inseriu (comentário com a marca + a linha seguinte)
s = s.replace(new RegExp(`^.*${MARK.replace('/', '\\/')}\\n.*\\n`, 'gm'), '')
s = s.replace(/android \{\n/, 'android {\n' + ANDROID_BLOCK)
s = s.replace(/    defaultConfig \{\n/, '    defaultConfig {\n' + DEFAULT_BLOCK)
fs.writeFileSync(gradle, s)
const ok = s.includes('buildStagingDirectory') && s.includes('CMAKE_MAKE_PROGRAM')
console.log(ok ? 'build C++ configurado em ' + gradle : 'ATENÇÃO: build.gradle não alterado')
if (!ok) process.exit(1)

// O que o `prebuild --clean` apaga: SDK em D: e build só arm64 com 2 trabalhadores
fs.writeFileSync(path.join(androidDir, 'local.properties'), 'sdk.dir=D:/dev/android-sdk\n')
const propsFile = path.join(androidDir, 'gradle.properties')
let props = fs.readFileSync(propsFile, 'utf8')
props = props.replace(/^reactNativeArchitectures=.*$/m, 'reactNativeArchitectures=arm64-v8a')
if (!props.includes('org.gradle.workers.max')) props += '\norg.gradle.workers.max=2\n'
fs.writeFileSync(propsFile, props)
console.log('local.properties e gradle.properties ajustados')
