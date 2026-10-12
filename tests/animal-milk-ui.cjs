const { chromium } = require('@playwright/test')
const assert = require('node:assert/strict')
const base = process.env.TEST_BASE_URL || 'http://localhost:3458'

async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 375, height: 900 } })
    const page = await context.newPage()
    page.setDefaultNavigationTimeout(120000)
    await page.clock.install({ time: new Date('2026-10-11T15:00:00Z') })
    const animals = [
      { id: 'young', code: '01', name: 'Jovem', species: 'Bezerra', gender: 'Fêmea', birthDate: '2024-04-12T00:00:00Z', status: 'Vivo', isCastrated: false, acquisitionType: 'nascimento' },
      { id: 'adult', code: '02', name: 'Adulta', species: 'Vaca', gender: 'Fêmea', birthDate: '2024-04-11T00:00:00Z', status: 'Vivo', isCastrated: false, acquisitionType: 'nascimento' },
      { id: 'male', code: '03', name: 'Macho', species: 'Touro', gender: 'Macho', birthDate: '2023-10-11T00:00:00Z', status: 'Vivo', isCastrated: false, acquisitionType: 'nascimento' },
    ]
    let price = 2.5
    const productions = [{ id: 'prod', animalId: null, animal: null, date: '2026-10-11T00:00:00Z', quantity: 100, cowsMilked: 5, pricePerLiter: 2.5, observations: 'Manhã' }]
    let editedAnimal, editedProduction, createdProduction
    await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 'test', name: 'Pessoa Teste', role: 'admin', email: 'test@example.com', farmId: 'farm', farmName: 'Fazenda Teste', permissions: null } }))
    await page.route('**/api/tarefas', route => route.fulfill({ json: [] }))
    await page.route('**/api/animals?*', route => route.fulfill({ json: animals }))
    await page.route('**/api/animals/male', route => {
      editedAnimal = route.request().postDataJSON()
      Object.assign(animals[2], editedAnimal)
      return route.fulfill({ json: animals[2] })
    })
    await page.route('**/api/milk-production?*', route => route.fulfill({ json: productions }))
    await page.route('**/api/milk-production/price', route => {
      if (route.request().method() === 'PUT') price = Number(route.request().postDataJSON().price.replace(',', '.'))
      return route.fulfill({ json: { price } })
    })
    await page.route('**/api/coletas?*', route => route.fulfill({ json: [] }))
    await page.route('**/api/milk-production/prod', route => {
      editedProduction = route.request().postDataJSON()
      Object.assign(productions[0], editedProduction)
      return route.fulfill({ json: productions[0] })
    })
    await page.route('**/api/milk-production', route => {
      createdProduction = route.request().postDataJSON()
      return route.fulfill({ status: 201, json: { id: 'new-prod', ...createdProduction } })
    })
    await page.goto(base + '/animais', { waitUntil: 'domcontentloaded' })
    await page.getByRole('row').filter({ has: page.getByText('Jovem', { exact: true }) }).click()
    assert.equal(await page.getByRole('button', { name: '+ Adicionar cria', exact: true }).isDisabled(), true)
    await page.getByRole('button', { name: 'Fechar', exact: true }).click()
    await page.getByRole('row').filter({ has: page.getByText('Adulta', { exact: true }) }).click()
    assert.equal(await page.getByRole('button', { name: '+ Adicionar cria', exact: true }).isEnabled(), true)
    await page.getByRole('button', { name: 'Fechar', exact: true }).click()
    await page.getByRole('row').filter({ has: page.getByText('Macho', { exact: true }) }).click()
    assert.equal(await page.getByRole('button', { name: '+ Adicionar cria', exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Fechar', exact: true }).click()
    await page.getByRole('button', { name: 'Editar animal Macho', exact: true }).click()
    await page.getByLabel('Animal castrado', { exact: true }).check()
    assert.equal(await page.locator('strong').filter({ hasText: 'Boi de engorda' }).count(), 1)
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.getByRole('heading', { name: 'Editar Animal' }).waitFor({ state: 'detached' })
    assert.equal(editedAnimal.isCastrated, true)

    await page.goto(base + '/milk-production', { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Preço padrão por litro (R$)', { exact: true }).fill('3,15')
    await page.getByRole('button', { name: 'Salvar preço', exact: true }).click()
    await page.getByText('Preço salvo.', { exact: true }).waitFor()
    assert.equal(price, 3.15); assert.equal(productions[0].pricePerLiter, 2.5)
    await page.locator('tbody tr').filter({ hasText: '100' }).first().click()
    await page.getByRole('button', { name: /Editar lançamento de/ }).click()
    await page.getByRole('dialog', { name: 'Editar produção de leite', exact: true }).waitFor()
    await page.getByLabel('Quantidade (litros)', { exact: true }).fill('120,5')
    await page.getByLabel('Preço por litro (R$)', { exact: true }).fill('2,65')
    await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
    await page.getByRole('dialog', { name: 'Editar produção de leite', exact: true }).waitFor({ state: 'detached' })
    assert.equal(editedProduction.quantity, 120.5); assert.equal(editedProduction.pricePerLiter, 2.65); assert.equal(productions.length, 1)
    await page.getByRole('button', { name: 'Anotar leite', exact: true }).click()
    await page.getByRole('heading', { name: 'Anotar leite', exact: true }).waitFor()
    await page.locator('input[placeholder="0"]').fill('50')
    await page.getByLabel(/Preço por litro \(R\$\)/).last().fill('2,90')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await page.waitForFunction(() => ![...document.querySelectorAll('h2')].some(h => h.textContent === 'Anotar leite') || document.body.textContent.includes('Salvo: 50,0 L'))
    if (await page.getByRole('heading', { name: 'Anotar leite', exact: true }).count()) await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    assert.equal(createdProduction.pricePerLiter, 2.9)
    const dimensions = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth])
    assert.ok(dimensions[1] <= dimensions[0] + 1)
    console.log('Telas de animais e leite passaram em 375 px: cria por idade/sexo, castração, preço e edição sem duplicação.')
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
