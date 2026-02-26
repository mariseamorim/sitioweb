export const MODULES = [
  { key: 'animais',      label: 'Animais' },
  { key: 'leite',        label: 'Produção de Leite' },
  { key: 'veterinario',  label: 'Tratamentos Vet.' },
  { key: 'vacinacao',    label: 'Vacinação' },
  { key: 'reproducao',   label: 'Reprodução' },
  { key: 'financeiro',   label: 'Financeiro' },
  { key: 'estoque',      label: 'Estoque' },
  { key: 'fazendas',     label: 'Fazendas' },
  { key: 'usuarios',     label: 'Usuários' },
] as const

export type ModuleKey = typeof MODULES[number]['key']
