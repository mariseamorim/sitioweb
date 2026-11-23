// Tipos de item do estoque do veterinário. O sêmen guarda touro, raça e partida, que preenchem a cobertura.
// Cópia de src/lib/vetSupplyKinds.ts do site.
export const VET_SUPPLY_KINDS = [
  { key: 'semen', label: 'Sêmen', unit: 'doses' },
  { key: 'medicamento', label: 'Medicamento', unit: 'frascos' },
  { key: 'material', label: 'Material', unit: 'un' },
  { key: 'outro', label: 'Outro', unit: 'un' },
] as const

export type VetSupplyKind = (typeof VET_SUPPLY_KINDS)[number]['key']
export const isVetSupplyKind = (v: unknown): v is VetSupplyKind => VET_SUPPLY_KINDS.some((k) => k.key === v)

/** Nome do sêmen como aparece na escolha da cobertura: "Netuno FIV · Gir · partida 2412-A (8 doses)" */
export const semenLabel = (s: { name: string; bullName?: string | null; bullBreed?: string | null; semenBatch?: string | null; quantity: number }) =>
  `${s.bullName || s.name}${s.bullBreed ? ` · ${s.bullBreed}` : ''}${s.semenBatch ? ` · partida ${s.semenBatch}` : ''} (${s.quantity} ${s.quantity === 1 ? 'dose' : 'doses'})`
