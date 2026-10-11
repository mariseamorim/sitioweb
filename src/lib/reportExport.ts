import type { Report } from '@/lib/reports'

function fileName(report: Report, ext: string) {
  const slug = report.title
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return `${slug}-${new Date().toISOString().slice(0, 10)}.${ext}`
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Planilha CSV no padrão do Excel em português (separador ";" e BOM para os acentos) */
export function exportCSV(report: Report) {
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
  download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), fileName(report, 'csv'))
}

export async function exportPDF(report: Report) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])

  const wide = report.sections.some((s) => s.columns.length > 6)
  const doc = new jsPDF({ orientation: wide ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const green: [number, number, number] = [21, 128, 61]

  doc.setFontSize(16)
  doc.setTextColor(17, 24, 39)
  doc.text(report.title, 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text(report.subtitle, 14, 25)

  let y = 32
  for (const section of report.sections) {
    if (section.title) {
      if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 18 }
      doc.setFontSize(12)
      doc.setTextColor(17, 24, 39)
      doc.text(section.title, 14, y)
      y += 3
    }
    const align: Record<number, { halign: 'right' }> = {}
    for (const i of section.numeric ?? []) align[i] = { halign: 'right' }

    autoTable(doc, {
      startY: y,
      head: [section.columns],
      body: section.rows.length ? section.rows : [[{ content: 'Nenhum registro', colSpan: section.columns.length }]],
      foot: section.footer ? [section.footer] : undefined,
      showFoot: 'lastPage',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: green },
      footStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: 'bold' },
      columnStyles: align,
      margin: { left: 14, right: 14 },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(156, 163, 175)
    doc.text(`Anota Aí Agro · página ${i} de ${pages}`, 14, doc.internal.pageSize.getHeight() - 8)
  }

  doc.save(fileName(report, 'pdf'))
}
