// Windows limita caminhos a 260 caracteres e a compilação nativa (CMake/ninja) do React Native estoura esse limite.
// Depois do `expo prebuild`, este script manda os arquivos intermediários do C++ para uma pasta curta (D:\x).
// Compile também a partir de um atalho curto para o projeto: `mklink /J D:\m C:\sitioweb\mobile` e `cd D:\m\android`.
const fs = require('fs')
const path = require('path')
const gradle = path.join(__dirname, '..', 'android', 'app', 'build.gradle')
let s = fs.readFileSync(gradle, 'utf8')
if (s.includes('buildStagingDirectory')) { console.log('pasta curta já configurada'); process.exit(0) }
s = s.replace(/android \{\n/, `android {
    // Caminho curto para o build C++ (limite de 260 caracteres do Windows); ver scripts/windows.js
    externalNativeBuild { cmake { buildStagingDirectory "D:/x" } }
`)
fs.writeFileSync(gradle, s)
console.log('build C++ em D:/x configurado em', gradle)
