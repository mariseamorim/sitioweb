// Exportar relatório: PDF (HTML impresso pelo expo-print) e planilha CSV (padrão do Excel em português), ambos compartilhados.
import { File, Paths } from 'expo-file-system'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import type { Report } from './reports'

function fileName(report: Report, ext: string) {
  const slug = report.title
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return `${slug}-${new Date().toISOString().slice(0, 10)}.${ext}`
}

async function share(uri: string, mimeType: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este aparelho não permite compartilhar arquivos.')
  await Sharing.shareAsync(uri, { mimeType, dialogTitle, UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text' })
}

/** Planilha CSV no padrão do Excel em português (separador ";" e BOM para os acentos) */
export async function exportCSV(report: Report) {
  const cell = (v: string | number | undefined) => {
    const s = String(v ?? '')
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines: string[] = [cell(report.title), cell(report.subtitle), '']
  for (const section of report.sections) {
    if (section.title) lines.push(cell(section.title))
    lines.push(section.columns.map(cell).join(';'))
    for (const row of section.rows) lines.push(row.map(cell).join(';'))
    if (section.footer) lines.push(section.footer.map(cell).join(';'))
    lines.push('')
  }
  const file = new File(Paths.cache, fileName(report, 'csv'))
  if (file.exists) file.delete()
  file.create()
  await file.write('﻿' + lines.join('\r\n'))
  await share(file.uri, 'text/csv', 'Baixar planilha')
}

const esc = (v: string | number | undefined) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** HTML do relatório (mesma aparência do PDF do site: cabeçalho verde, rodapé em cinza) */
export function reportHtml(report: Report): string {
  const sections = report.sections.map(s => {
    const align = (j: number) => (s.numeric?.includes(j) ? ' class="num"' : '')
    const head = s.columns.map((c, j) => `<th${align(j)}>${esc(c)}</th>`).join('')
    const body = s.rows.length
      ? s.rows.map(r => `<tr>${r.map((v, j) => `<td${align(j)}>${esc(v)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${s.columns.length}" class="empty">Nenhum registro</td></tr>`
    const foot = s.footer ? `<tfoot><tr>${s.footer.map((v, j) => `<td${align(j)}>${esc(v)}</td>`).join('')}</tr></tfoot>` : ''
    return `<section>${s.title ? `<h2>${esc(s.title)}</h2>` : ''}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table></section>`
  }).join('')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
    body { font-family: Helvetica, Arial, sans-serif; color: #111827; margin: 24px; font-size: 12px; }
    h1 { font-size: 20px; margin: 0 0 4px; } .sub { color: #6b7280; font-size: 12px; margin: 0 0 18px; }
    h2 { font-size: 14px; margin: 18px 0 6px; } section { page-break-inside: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; } tr { page-break-inside: avoid; }
    th { background: #15803d; color: #fff; text-align: left; padding: 5px 6px; font-weight: 600; }
    td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tfoot td { background: #f3f4f6; font-weight: 700; border-top: 2px solid #d1d5db; }
    .num { text-align: right; white-space: nowrap; } .empty { text-align: center; color: #9ca3af; padding: 14px; }
    .foot { margin-top: 20px; color: #9ca3af; font-size: 10px; }
  </style></head><body>
    <h1>${esc(report.title)}</h1><p class="sub">${esc(report.subtitle)}</p>${sections}
    <p class="foot">Anota Aí Agro · gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
  </body></html>`
}

export async function exportPDF(report: Report) {
  // Página A4 (72 ppi); relatório largo sai deitado, como no site
  const wide = report.sections.some(s => s.columns.length > 6)
  const { uri } = await Print.printToFileAsync({ html: reportHtml(report), width: wide ? 842 : 595, height: wide ? 595 : 842 })
  // O expo-print gera um nome aleatório: renomeia para o nome do relatório antes de compartilhar
  const target = new File(Paths.cache, fileName(report, 'pdf'))
  if (target.exists) target.delete()
  await new File(uri).move(target)
  await share(target.uri, 'application/pdf', 'Baixar PDF')
}
