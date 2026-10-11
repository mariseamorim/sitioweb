const { chromium } = require('@playwright/test')
const assert = require('node:assert/strict')
const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' })
    const page = await context.newPage()
    await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 'test', name: 'Pessoa Teste', role: 'admin', email: 'test@example.com', farmId: null, farmName: 'Propriedade com um nome bastante comprido', permissions: null } }))
    await page.route('**/api/farms', route => route.fulfill({ json: [] }))
    for (const width of (process.env.TEST_ONLY_PWA === '1' ? [] : [320, 375, 768, 1024, 1440])) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['/inicio', '/cadastro', '/fazendas', '/estoque']) {
        await page.goto(base + path, { waitUntil: 'domcontentloaded' })
        await page.locator('body').waitFor()
        await page.waitForTimeout(300)
        if (path === '/fazendas') {
          await page.getByRole('button', { name: 'Cadastrar propriedade', exact: true }).click()
          await page.getByRole('heading', { name: 'Cadastrar propriedade', exact: true }).waitFor()
        }
        const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }))
        const overflowingFields = await page.locator('input,select,textarea').evaluateAll(fields => fields.filter(field => { const r = field.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) }).length)
        assert.equal(overflowingFields, 0, path + ': campos fora da tela em ' + width)
        assert.ok(dimensions.scroll <= width + 1, path + ' transborda em ' + width + ': ' + JSON.stringify(dimensions))
      }
      await page.goto(base + '/fazendas')
      if (width < 1024) {
        await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
        await page.getByRole('dialog', { name: 'Menu de navegação' }).waitFor()
        await page.keyboard.press('Escape')
        await page.getByRole('dialog', { name: 'Menu de navegação' }).waitFor({ state: 'detached' })
      }
      if (width >= 1024) {
        await page.getByRole('button', { name: 'Recolher menu', exact: true }).click()
        await page.locator('#menu-computador').waitFor({ state: 'hidden' })
        await page.getByRole('button', { name: 'Abrir menu lateral', exact: true }).click()
        await page.locator('#menu-computador').waitFor({ state: 'visible' })
      }
      await page.goto(base + '/inicio')
      if (width < 1024) {
        await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
        await assert.doesNotReject(() => page.locator('#landing-mobile-menu').waitFor({ state: 'visible' }))
        await page.locator('#landing-mobile-menu').getByRole('link', { name: 'Fale conosco' }).click()
        await page.locator('#landing-mobile-menu').waitFor({ state: 'detached' })
      }
      await page.getByRole('button', { name: 'Fale conosco ou agende uma demonstração' }).click()
      await page.getByLabel('Seu nome *', { exact: true }).waitFor({ state: 'visible' })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      console.log('Layout e menu aprovados em ' + width + 'px')
    }
    await context.close()
    if (process.env.TEST_PWA === '1') {
      const pwa = await chromium.launchPersistentContext('', { executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true })
      try {
      const tab = await pwa.newPage()
      await tab.goto(base + '/inicio')
      await tab.evaluate(() => navigator.serviceWorker.ready)
      await tab.reload()
      await tab.waitForFunction(() => !!navigator.serviceWorker.controller)
      const manifestResponse = await tab.request.get(base + '/manifest.json')
      const manifest = await manifestResponse.json()
      assert.equal(manifest.display, 'standalone')
      assert.equal(manifest.scope, '/')
      for (const icon of manifest.icons) assert.equal((await tab.request.get(base + icon.src)).status(), 200)
      const sw = await tab.request.get(base + '/sw.js')
      assert.equal(sw.status(), 200)
      assert.ok(sw.headers()['cache-control'].includes('no-cache'))
      const cdp = await pwa.newCDPSession(tab)
      const install = await cdp.send('Page.getInstallabilityErrors')
      assert.deepEqual(install.installabilityErrors, [])
      await pwa.setOffline(true)
      await tab.goto(base + '/inicio')
      await tab.getByRole('heading', { level: 1 }).waitFor()
      await tab.goto(base + '/pagina-nao-visitada-no-teste')
      await tab.getByRole('heading', { name: 'Você está offline' }).waitFor()
      await pwa.setOffline(false)
      } finally { await pwa.close() }
      console.log('PWA: registro, controle, manifesto, ícones, instalação, página em cache e fallback offline aprovados.')
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
