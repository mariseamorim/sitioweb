// Estoque: a movimentação salva sozinha (cria, corrige, desfaz), o saldo aparece sem recarregar e sem internet fica no aparelho
// Precisa do site rodando (TEST_BASE_URL ou http://localhost:3458). node tests/estoque-autosave.cjs
const { chromium } = require('@playwright/test')
const assert = require('node:assert/strict')
const base = process.env.TEST_BASE_URL || 'http://localhost:3458'

const until = async (check, what, ms = 8000) => {
  const end = Date.now() + ms
  while (!check()) { if (Date.now() > end) throw new Error('esperando: ' + what); await new Promise((r) => setTimeout(r, 100)) }
}

async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 375, height: 900 } })
    const page = await context.newPage()
    page.setDefaultNavigationTimeout(120000)
    page.setDefaultTimeout(15000)

    const supply = { id: 's1', name: 'Ração', category: 'Ração', unit: 'kg', currentQuantity: 100, minimumQuantity: 10, movements: [], dailyUseKg: 2, daysLeft: 50, unitPrice: null, packageKg: null }
    const posts = [], patches = [], deletes = []
    let lists = 0
    const signed = (m) => (m.type === 'Entrada' ? Number(m.quantity) : -Number(m.quantity))
    const reply = (movement) => ({ movement, supply: { ...supply, movements: movement ? [{ id: movement.id, type: movement.type, quantity: movement.quantity, date: movement.date + 'T00:00:00.000Z', description: movement.description }] : [] } })

    await page.route('**/api/auth/me', (route) => route.fulfill({ json: { id: 'test', name: 'Pessoa Teste', role: 'admin', email: 'test@example.com', farmId: 'farm', farmName: 'Fazenda Teste', permissions: null } }))
    await page.route('**/api/tarefas', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/estoque?*', (route) => { lists++; return route.fulfill({ json: [supply] }) })
    await page.route('**/api/estoque/s1/movimentacao', (route) => {
      const body = route.request().postDataJSON()
      posts.push(body)
      supply.currentQuantity += signed(body)
      return route.fulfill({ status: 201, json: reply({ id: 'm' + posts.length, ...body }) })
    })
    await page.route('**/api/estoque/s1/movimentacao/m1', (route) => {
      if (route.request().method() === 'DELETE') {
        deletes.push(true)
        supply.currentQuantity -= signed(patches[patches.length - 1] ?? posts[0])
        return route.fulfill({ json: reply(null) })
      }
      const body = route.request().postDataJSON()
      const before = patches[patches.length - 1] ?? posts[0]
      patches.push(body)
      supply.currentQuantity += signed(body) - signed(before)
      return route.fulfill({ json: reply({ id: 'm1', ...body }) })
    })

    await page.goto(base + '/estoque', { waitUntil: 'domcontentloaded' })
    await page.getByRole('row').filter({ hasText: 'Ração' }).click()
    await page.getByRole('button', { name: '+ Movimentação (Entrada / Saída)', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Movimentação', exact: true })
    await dialog.getByText('Informe a quantidade: o lançamento é salvo sozinho.').waitFor()
    assert.equal(await dialog.getByRole('button', { name: 'Salvar', exact: true }).count(), 0, 'não tem botão Salvar: grava sozinho')

    // 1. Digitou a quantidade e parou: salva sozinho e o saldo muda na ficha e na lista
    await dialog.getByLabel('Quantidade (kg) *').fill('10')
    await dialog.getByText('Salvo. Pode corrigir os campos ou desfazer.').waitFor()
    assert.equal(posts.length, 1)
    assert.equal(posts[0].type, 'Entrada'); assert.equal(posts[0].quantity, 10); assert.match(posts[0].date, /^\d{4}-\d{2}-\d{2}$/); assert.equal(posts[0].description, null)
    await dialog.getByText('saldo atual 110 kg').waitFor()

    // 2. Trocou para saída: corrige a mesma movimentação, sem criar outra
    await dialog.getByLabel('Tipo *').selectOption('Saída')
    await until(() => patches.length === 1, 'correção enviada')
    assert.equal(patches[0].type, 'Saída'); assert.equal(patches[0].quantity, 10)
    await dialog.getByText('saldo atual 90 kg').waitFor()
    assert.equal(posts.length, 1, 'não duplicou')

    // 3. Desfazer: apaga no servidor, saldo volta, formulário limpo
    await dialog.getByRole('button', { name: 'Desfazer', exact: true }).click()
    await dialog.getByText('Informe a quantidade: o lançamento é salvo sozinho.').waitFor()
    assert.equal(deletes.length, 1)
    assert.equal(await dialog.getByLabel('Quantidade (kg) *').inputValue(), '')
    await dialog.getByText('saldo atual 100 kg').waitFor()

    // 4. Concluir logo depois de digitar: salva antes de fechar, e a lista mostra o saldo novo sem recarregar
    await dialog.getByLabel('Quantidade (kg) *').fill('5')
    await dialog.getByLabel('Descrição').fill('compra')
    await dialog.getByRole('button', { name: 'Concluir', exact: true }).click()
    await dialog.waitFor({ state: 'detached' })
    await until(() => posts.length === 2, 'segundo lançamento')
    assert.equal(posts[1].quantity, 5); assert.equal(posts[1].description, 'compra')
    await page.getByRole('button', { name: 'Fechar', exact: true }).click()
    const listsBefore = lists
    await page.getByRole('row').filter({ hasText: 'Ração' }).getByText('105 kg').waitFor()
    assert.equal(lists, listsBefore, 'lista atualizada sem buscar de novo')

    // 5. Sem internet: fica no aparelho, saldo já reflete, e ao voltar a internet é enviado sozinho
    await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }); window.dispatchEvent(new Event('offline')) })
    await page.getByText('Sem internet. Ao salvar, os registros ficam neste aparelho.', { exact: false }).waitFor()
    await page.getByRole('row').filter({ hasText: 'Ração' }).click()
    await page.getByRole('button', { name: '+ Movimentação (Entrada / Saída)', exact: true }).click()
    await dialog.getByLabel('Quantidade (kg) *').fill('3')
    await dialog.getByText('Salvo no celular. Será enviado quando houver internet.').waitFor()
    assert.equal(posts.length, 2, 'sem internet não chama a API')
    await dialog.getByText('saldo atual 108 kg').waitFor()
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pending_estoque-mov') || '[]').length), 1)
    await dialog.getByRole('button', { name: 'Concluir', exact: true }).click()
    await dialog.waitFor({ state: 'detached' })
    await page.getByText('a enviar', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Fechar', exact: true }).click()
    await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true }); window.dispatchEvent(new Event('online')) })
    await until(() => posts.length === 3, 'envio automático ao voltar a internet')
    assert.equal(posts[2].quantity, 3); assert.equal(posts[2].type, 'Entrada')
    await until(() => lists > listsBefore, 'lista recarregada depois do envio')
    await page.getByRole('row').filter({ hasText: 'Ração' }).getByText('108 kg').waitFor()
    assert.equal(await page.evaluate(() => localStorage.getItem('pending_estoque-mov')), null, 'fila esvaziada')
    assert.equal(await page.getByText('pendente', { exact: false }).count(), 0)

    const dimensions = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth])
    assert.ok(dimensions[1] <= dimensions[0] + 1, 'sem rolagem horizontal')
    console.log('Estoque em 375 px: movimentação salva sozinha, corrige, desfaz, mostra o saldo sem recarregar e guarda sem internet.')
  } finally { await browser.close() }
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
