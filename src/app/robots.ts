import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/inicio',
          '/criar-conta',
          '/lite/cadastro',
          '/fornecedor/cadastro',
          '/manual',
          '/manual/',
          '/ajuda',
          '/privacidade',
          '/login',
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/perfil/',
          '/usuarios/',
          '/animais/',
          '/engorda/',
          '/estoque/',
          '/fazendas/',
          '/financeiro/',
          '/milk-production/',
          '/reproducao/',
          '/tratamentos/',
          '/vacinacao/',
          '/relatorios/',
          '/ofertas/',
          '/consultoria/',
          '/fornecedor/',
          '/laticinio/',
          '/associacao/',
          '/associar/',
          '/organizacao/',
          '/setup/',
          '/offline/',
        ],
      },
    ],
    sitemap: 'https://www.anotaaiagro.com.br/sitemap.xml',
  }
}
