import type { MetadataRoute } from 'next'

const BASE = 'https://www.anotaaiagro.com.br'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${BASE}/inicio`, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/criar-conta`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/lite/cadastro`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/fornecedor/cadastro`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/manual`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/manual/campos-editaveis.html`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/ajuda`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/privacidade`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
  ]
}
