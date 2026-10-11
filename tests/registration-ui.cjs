const { chromium } = require('@playwright/test')
const assert = require('node:assert/strict')
const base = process.env.TEST_BASE_URL || 'http://localhost:3458'

async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 375, height: 900 } })
    const page = await context.newPage()
    let account = null
    const posted = []
    await page.route('**/api/auth/me', route => route.fulfill({ status: account ? 200 : 401, json: account || { error: 'Faça login' } }))
    await page.route('**/api/auth/google/config', route => route.fulfill({ json: { enabled: true } }))
    await page.route('**/api/auth/register', async route => {
      const data = route.request().postDataJSON(); posted.push(data)
      if (data.user) account = { id: 'test-user', name: data.user.name, email: data.user.email, role: 'onboarding', permissions: [] }
      await route.fulfill({ status: data.farm ? 400 : 201, json: data.farm ? { error: 'Resposta simulada para permanecer na tela' } : { id: 'test-user', name: account.name } })
    })
    await page.goto(base + '/cadastro?convite=TESTCODE')
    await page.getByRole('button', { name: 'Continuar com Google' }).waitFor()
    assert.equal(await page.getByLabel('Nome da propriedade', { exact: true }).count(), 0)
    await page.getByLabel('Seu nome', { exact: true }).fill('Pessoa Teste')
    await page.getByLabel('E-mail', { exact: true }).fill('pessoa@example.com')
    await page.getByLabel('Senha', { exact: true }).fill('secret123')
    await page.getByLabel('Confirmar senha', { exact: true }).fill('secret123')
    await page.getByRole('button', { name: 'Criar conta e continuar' }).click()
    await page.getByRole('heading', { name: 'Cadastre sua propriedade' }).waitFor()
    assert.equal(posted.length, 1); assert.ok(posted[0].user); assert.equal('farm' in posted[0], false)
    assert.equal(await page.locator('input[type=email]').count(), 0)
    await page.getByLabel('Nome da propriedade', { exact: true }).fill('Fazenda Teste')
    await page.getByRole('button', { name: 'Salvar propriedade e começar' }).click()
    await page.getByText('Resposta simulada para permanecer na tela', { exact: true }).waitFor()
    assert.equal(posted[1].inviteCode, 'TESTCODE'); assert.equal('user' in posted[1], false); assert.equal('email' in posted[1].farm, false)
    await page.reload()
    await page.getByRole('heading', { name: 'Cadastre sua propriedade' }).waitFor()
    assert.equal(await page.getByLabel('E-mail', { exact: true }).count(), 0)
    let dimensions = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth])
    assert.ok(dimensions[1] <= dimensions[0] + 1)

    await page.goto(base + '/lite/cadastro?perfil=motorista')
    await page.getByText('Conta criada para pessoa@example.com.', { exact: false }).waitFor()
    assert.equal(await page.locator('input[type=email],input[type=password]').count(), 0)
    await page.getByRole('button', { name: /Sou motorista ou coletor/ }).waitFor()
    assert.equal(await page.getByRole('button', { name: /Sou motorista ou coletor/ }).getAttribute('aria-pressed'), 'true')
    assert.equal(await page.getByLabel('Nome do local').count(), 1)

    await page.goto(base + '/fornecedor/cadastro')
    await page.getByText('Conta criada para pessoa@example.com.', { exact: false }).waitFor()
    assert.equal(await page.locator('input[type=email],input[type=password]').count(), 0)
    assert.equal(await page.getByLabel('Seu nome *', { exact: true }).inputValue(), 'Pessoa Teste')

    account = null
    await page.goto(base + '/login?googleError=link')
    await page.getByText('Este e-mail já tem uma conta. Entre com sua senha e conecte o Google em Meu cadastro.', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Continuar com Google' }).waitFor()
    console.log('Telas: usuário antes da propriedade, e-mail único, retomada, Google e perfis Lite/fornecedor passaram em 375 px.')
  } finally { await browser.close() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
