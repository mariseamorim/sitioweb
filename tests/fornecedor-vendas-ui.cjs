// Painel do fornecedor, seção Vendas: ranking das ofertas, confirmar contato como venda, registrar venda à mão, trocar o período
// Precisa do site rodando (TEST_BASE_URL ou http://localhost:3458). node tests/fornecedor-vendas-ui.cjs
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

    const offers = [
      { id: 'o1', title: 'Sal mineral 30 kg', description: null, category: 'Sal mineral', price: 95, unit: 'Saco', imageUrl: null, reach: 'clientes', validUntil: '2027-01-01T00:00:00.000Z', isActive: true, whatsappClicks: 4 },
      { id: 'o2', title: 'Ração 22%', description: null, category: 'Ração', price: 80, unit: 'Saco', imageUrl: null, reach: 'clientes', validUntil: '2027-01-01T00:00:00.000Z', isActive: true, whatsappClicks: 1 },
    ]
    const farm = { name: 'Fazenda Teste', owner: 'Zé', city: 'Lavras', state: 'MG', phone: '35999990000' }
    let contacts = [
      { id: 'c1', promotionId: 'o1', offerTitle: 'Sal mineral 30 kg', farmId: 'f1', farm, buyerName: null, status: 'venda', source: 'clique', saleValue: 95, quantity: 1, soldAt: '2026-10-03T00:00:00.000Z', note: null, createdAt: '2026-10-02T12:00:00.000Z' },
      { id: 'c2', promotionId: 'o1', offerTitle: 'Sal mineral 30 kg', farmId: 'f1', farm, buyerName: null, status: 'contato', source: 'clique', saleValue: null, quantity: null, soldAt: null, note: null, createdAt: '2026-10-07T12:00:00.000Z' },
    ]
    const queries = [], patches = [], posts = []
    const report = () => {
      const sales = contacts.filter((c) => c.status === 'venda')
      const byOffer = offers.map((o) => { const mine = contacts.filter((c) => c.promotionId === o.id); const sold = mine.filter((c) => c.status === 'venda'); return { id: o.id, title: o.title, category: o.category, price: o.price, unit: o.unit, contacts: mine.length, sales: sold.length, lost: 0, rate: mine.length ? Math.round(sold.length / mine.length * 100) : null, revenue: sold.reduce((s, c) => s + (c.saleValue ?? 0), 0), quantity: 0 } }).filter((o) => o.contacts).sort((a, b) => b.sales - a.sales)
      return { range: { from: '2026-10-01', to: '2026-10-18' }, totals: { contacts: contacts.length, sales: sales.length, lost: 0, rate: Math.round(sales.length / contacts.length * 100), revenue: sales.reduce((s, c) => s + (c.saleValue ?? 0), 0) }, byOffer, byMonth: [{ month: '2026-10', contacts: contacts.length, sales: sales.length, revenue: 0 }], requestsClosed: { count: 1, value: 300 }, pending: contacts.filter((c) => c.status === 'contato'), sales }
    }
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: { id: 'v', name: 'Loja Teste', role: 'fornecedor', email: 'v@example.com', farmId: null, vendorId: 'v1', permissions: null } }))
    await page.route('**/api/tarefas', (route) => route.fulfill({ json: [] }))
    await page.route('**/api/fornecedor', (route) => route.fulfill({ json: {
      vendor: { companyName: 'Loja Teste', contactName: 'Ana', status: 'aprovado', inviteCode: 'ABC123', state: 'MG', city: 'Lavras', categories: [] },
      offers, clients: [{ id: 'vc1', farmId: 'f1', name: 'Fazenda Teste', owner: 'Zé', city: 'Lavras', state: 'MG', phone: '35999990000', since: '2026-09-01T00:00:00.000Z' }],
      offersThisWeek: 0, weeklyLimit: 3, requests: [], needs: [], salesThisMonth: contacts.filter((c) => c.status === 'venda').length, contactsToConfirm: contacts.filter((c) => c.status === 'contato').length,
    } }))
    await page.route('**/api/fornecedor/vendas?*', (route) => { queries.push(new URL(route.request().url()).search); return route.fulfill({ json: report() }) })
    await page.route('**/api/fornecedor/vendas', (route) => {
      const body = route.request().postDataJSON()
      posts.push(body)
      contacts.push({ id: 'novo', promotionId: body.promotionId, offerTitle: offers.find((o) => o.id === body.promotionId).title, farmId: body.farmId || null, farm: body.farmId ? farm : null, buyerName: body.buyerName || null, status: 'venda', source: 'manual', saleValue: Number(String(body.saleValue).replace(',', '.')) || null, quantity: null, soldAt: body.soldAt + 'T00:00:00.000Z', note: null, createdAt: '2026-10-18T12:00:00.000Z' })
      return route.fulfill({ status: 201, json: contacts.at(-1) })
    })
    await page.route('**/api/fornecedor/vendas/c2', (route) => {
      const body = route.request().postDataJSON()
      patches.push(body)
      const c = contacts.find((x) => x.id === 'c2')
      Object.assign(c, { status: body.status, saleValue: body.saleValue ? Number(String(body.saleValue).replace(',', '.')) : null, soldAt: body.soldAt ? body.soldAt + 'T00:00:00.000Z' : null })
      return route.fulfill({ json: c })
    })

    await page.goto(base + '/fornecedor', { waitUntil: 'domcontentloaded' })
    const card = page.getByRole('navigation', { name: 'Seções do painel' }).getByRole('button', { name: /Vendas no mês/ })
    assert.match(await card.innerText(), /1/)
    await card.click()

    // Ranking e totais
    await page.getByRole('heading', { name: 'Ofertas que mais venderam' }).waitFor()
    assert.match(queries[0], /from=\d{4}-\d{2}-01&to=/)
    assert.match(await page.locator('body').innerText(), /Sal mineral 30 kg foi a melhor do período: 1 venda em 2 contatos \(50%\), R\$\s?95,00/)
    assert.match(await page.locator('tbody tr').first().innerText(), /1\. Sal mineral 30 kg/)
    assert.match(await page.locator('body').innerText(), /1 pedido de orçamento atendido \(R\$\s?300,00\)/)

    // Contato do WhatsApp vira venda
    await page.getByRole('button', { name: 'Virou venda', exact: true }).click()
    assert.equal(await page.getByLabel('Valor (R$)').inputValue(), '95,00', 'valor sugerido pelo preço da oferta')
    assert.equal(await page.getByLabel('Quantidade').inputValue(), '1')
    await page.getByRole('button', { name: 'Confirmar venda', exact: true }).click()
    await page.getByText('Nenhum contato esperando resposta.').waitFor()
    assert.deepEqual(patches[0].status, 'venda'); assert.equal(patches[0].saleValue, '95,00'); assert.equal(patches[0].quantity, '1'); assert.match(patches[0].soldAt, /^\d{4}-\d{2}-\d{2}$/)
    assert.match(await page.locator('body').innerText(), /2 vendas em 2 contatos \(100%\)/)

    // Venda registrada à mão, para quem não está no app
    await page.getByRole('button', { name: '+ Registrar venda', exact: true }).click()
    const form = page.getByRole('form', { name: 'Registrar venda' })
    assert.equal(await form.getByLabel('Valor (R$)').inputValue(), '95,00', 'primeira oferta: R$ 95 × 1')
    await form.getByLabel('Oferta *').selectOption('o2')
    assert.equal(await form.getByLabel('Valor (R$)').inputValue(), '80,00', 'trocou a oferta: preço dela')
    await form.getByLabel('Quantidade').fill('2')
    assert.equal(await form.getByLabel('Valor (R$)').inputValue(), '160,00', 'quantidade 2: dobra')
    await form.getByLabel('Nome do comprador').fill('Sítio Boa Vista')
    await form.getByRole('button', { name: 'Salvar venda', exact: true }).click()
    await form.waitFor({ state: 'detached' })
    assert.equal(posts[0].promotionId, 'o2'); assert.equal(posts[0].buyerName, 'Sítio Boa Vista'); assert.equal(posts[0].farmId, ''); assert.equal(posts[0].saleValue, '160,00'); assert.equal(posts[0].quantity, '2')

    // Sem comprador e sem cliente também salva
    await page.getByRole('button', { name: '+ Registrar venda', exact: true }).click()
    await form.getByRole('button', { name: 'Salvar venda', exact: true }).click()
    await form.waitFor({ state: 'detached' })
    assert.equal(posts[1].buyerName, ''); assert.equal(posts[1].quantity, '1')
    await page.getByText('Sítio Boa Vista', { exact: false }).first().waitFor()
    assert.match(await page.locator('body').innerText(), /registrada à mão/)

    // Período: "Este ano" pede de 1º de janeiro
    await page.getByRole('button', { name: 'Este ano', exact: true }).click()
    await page.waitForFunction((n) => true, queries.length)
    const last = () => queries.at(-1)
    for (let i = 0; i < 30 && !/from=\d{4}-01-01/.test(last()); i++) await page.waitForTimeout(100)
    assert.match(last(), /from=\d{4}-01-01&to=/)

    const dimensions = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth])
    assert.ok(dimensions[1] <= dimensions[0] + 1, 'sem rolagem horizontal')
    console.log('Fornecedor, Vendas em 375 px: ranking, contato vira venda, venda à mão e período passaram.')
  } finally { await browser.close() }
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
