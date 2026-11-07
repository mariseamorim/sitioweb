// Windows limita caminhos a 260 caracteres e a compilação nativa (CMake/ninja) do React Native estoura esse limite,
// mesmo com LongPathsEnabled=1: o ninja 1.10 que vem com o CMake do Android SDK não usa caminhos longos.
// Depois do `expo prebuild`, este script:
//  - manda os arquivos intermediários do C++ para uma pasta curta (D:/x);
//  - usa o CMake 3.31 do SDK (`sdkmanager "cmake;3.31.0"`) com um ninja 1.13 avulso em D:/dev/ninja/ninja.exe
//    (instalado com `winget install Ninja-build.Ninja` e copiado para lá), que aceita caminhos longos.
// Não use um atalho (mklink /J) para encurtar o caminho do projeto: o empacotador do JavaScript exige o caminho real.
const fs = require('fs')
const path = require('path')
const gradle = path.join(__dirname, '..', 'android', 'app', 'build.gradle')
const BLOCK = `    // Caminho curto e ninja com caminhos longos para o build C++ (limite de 260 caracteres do Windows); ver scripts/windows.js
    externalNativeBuild { cmake { buildStagingDirectory "D:/x"; version "3.31.0"; arguments "-DCMAKE_MAKE_PROGRAM=D:/dev/ninja/ninja.exe" } }
`
let s = fs.readFileSync(gradle, 'utf8')
if (s.includes('buildStagingDirectory')) {
  s = s.replace(/^.*ver scripts\/windows\.js\n.*buildStagingDirectory.*\n/m, BLOCK)
} else {
  s = s.replace(/android \{\n/, 'android {\n' + BLOCK)
}
fs.writeFileSync(gradle, s)
console.log(s.includes('CMAKE_MAKE_PROGRAM') ? 'build C++ configurado em ' + gradle : 'ATENÇÃO: build.gradle não alterado')
