// Financeiro: o lançamento feito sem internet aparece na lista e nos totais na hora (sem F5) e pode sair da fila
// Precisa do site rodando (TEST_BASE_URL ou http://localhost:3458). node tests/financeiro-offline.cjs
const { chromium } = require('@playwright/test')
const assert = require('node:assert/strict')
const base = process.env.TEST_BASE_URL || 'http://localhost:3458'

async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 375, height: 900 } })
    const page = await context.newPage()
    page.setDefaultNavigationTimeout(120000)
    page.setDefaultTimeout(15000)
    let lists = 0, posts = 0
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: { id: 'test', name: 'Pessoa Teste', role: 'admin', email: 'test@example.com', farmId: 'farm', farmName: 'Fazenda Teste', permissions: null } }))
    await page.route('**/api/tarefas', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/animals?*', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/financeiro?*', (route) => { lists++; return route.fulfill({ json: [{ id: 't1', type: 'Despesa', category: 'Ração', date: new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z', amount: 40, description: 'saco', animal: null }] }) })
    await page.route('**/api/financeiro', (route) => { posts++; return route.fulfill({ status: 201, json: { id: 'novo' } }) })

    await page.goto(base + '/financeiro', { waitUntil: 'domcontentloaded' })
    await page.getByRole('row').filter({ hasText: 'saco' }).waitFor()

    // Caiu a internet: salvar guarda no aparelho e a linha aparece na hora, entrando no total
    await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }); window.dispatchEvent(new Event('offline')) })
    await page.getByRole('button', { name: 'Anotar entrada ou saída', exact: true }).click()
    const form = page.locator('form').filter({ has: page.locator('input[type="number"]') })
    await form.locator('input[type="number"]').fill('150')
    await form.locator('input[type="text"]').first().fill('leite da semana')
    await form.getByRole('button', { name: /Salvar/ }).click()
    const row = page.getByRole('row').filter({ hasText: 'a enviar' })
    await row.waitFor()
    assert.match(await row.innerText(), /150,00/)
    assert.equal(posts, 0, 'sem internet não chama a API')
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pending_financeiro') || '[]').length), 1)
    const text = await page.locator('body').innerText()
    assert.match(text, /150,00/)
    assert.ok(/pendente/.test(text) || /Sem internet/.test(text), 'avisa que há registro no aparelho')

    // Excluir a linha pendente tira da fila, sem chamar a API
    page.once('dialog', (d) => d.accept())
    await row.getByRole('button').click()
    const confirm = page.getByRole('button', { name: 'Excluir', exact: true })
    if (await confirm.count()) await confirm.click()
    await row.waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => localStorage.getItem('pending_financeiro')), null, 'fila esvaziada')
    assert.ok(lists >= 1)

    const dimensions = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth])
    assert.ok(dimensions[1] <= dimensions[0] + 1, 'sem rolagem horizontal')
    console.log('Financeiro em 375 px: lançamento sem internet aparece na hora e sai da fila ao excluir.')
  } finally { await browser.close() }
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
