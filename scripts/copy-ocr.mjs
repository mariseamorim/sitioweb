// Leitura da folha pela foto (OCR): copia o worker e os núcleos do Tesseract para public/ocr,
// para servir do próprio site (funciona sem internet depois da primeira leitura) sem versionar 12 MB.
// Roda no postinstall. O idioma (por.traineddata.gz, 1 MB) fica versionado em public/ocr.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const out = join(process.cwd(), 'public', 'ocr')
mkdirSync(out, { recursive: true })

const files = [
  [join(dirname(require.resolve('tesseract.js/package.json')), 'dist', 'worker.min.js'), 'worker.min.js'],
  ...['tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js']
    .map((name) => [join(dirname(require.resolve('tesseract.js-core/package.json')), name), name]),
]
for (const [from, name] of files) {
  if (!existsSync(from)) { console.warn(`[ocr] não achei ${from}`); continue }
  copyFileSync(from, join(out, name))
}
console.log(`[ocr] ${files.length} arquivos em public/ocr`)
