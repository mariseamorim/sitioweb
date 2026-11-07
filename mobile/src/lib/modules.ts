// Módulos do sistema e nomes dos perfis, iguais aos do site (src/lib/modules.ts e a tela de usuários).
export const MODULES = [
  { key: 'animais', label: 'Animais' },
  { key: 'leite', label: 'Produção de Leite' },
  { key: 'veterinario', label: 'Tratamentos Vet.' },
  { key: 'vacinacao', label: 'Vacinação' },
  { key: 'reproducao', label: 'Reprodução' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'estoque', label: 'Estoque' },
  { key: 'fazendas', label: 'Fazendas' },
  { key: 'usuarios', label: 'Usuários' },
] as const

export type ModuleKey = (typeof MODULES)[number]['key']

/** Perfis da equipe como aparecem na tela de usuários do site */
export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Visualizador',
}

export const TEAM_ROLES = [
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Visualizador' },
]
