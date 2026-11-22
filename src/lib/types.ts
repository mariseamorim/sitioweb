export interface Fazenda {
  id: string;
  nome: string;
  localizacao: string;
  proprietario: string;
  area: string;
  criadoEm: string;
}

export type Sexo = 'Macho' | 'Fêmea';

export type StatusAnimal = 'Vivo' | 'Morto' | 'Vendido' | 'Doente' | 'Arrendado' | '';

export type MotivoBaixa = 'Morto' | 'Vendido' | 'Consumo Próprio' | 'Sem Alteração' | 'Aguardando' | '';

export type Especie = string;

export interface Animal {
  id: string;
  fazendaId: string;
  nome: string;
  especie: Especie;
  sexo: Sexo;
  dataNascimento: string;
  status: StatusAnimal;
  dataBaixa: string;
  motivoBaixa: MotivoBaixa;
  numeroGTA: string;
  observacao: string;
  foto: string; // base64
}

/** Espécies do cadastro, por grupo (a mesma lista em mobile/src/repos/animals.ts). Bovinos mudam de categoria pela idade. */
export const ESPECIE_GRUPOS: { label: string; species: string[] }[] = [
  { label: 'Bovinos', species: ['Vaca', 'Novilha', 'Bezerra', 'Touro', 'Garrote', 'Bezerro', 'Boi', 'Boi de engorda'] },
  { label: 'Búfalos', species: ['Búfala', 'Búfalo'] },
  { label: 'Equinos', species: ['Cavalo', 'Égua', 'Potro', 'Mula', 'Burro'] },
  { label: 'Ovinos e caprinos', species: ['Ovelha', 'Carneiro', 'Cabra', 'Bode'] },
  { label: 'Suínos', species: ['Porco', 'Porca'] },
  { label: 'Aves', species: ['Galinha', 'Galo', 'Pato', 'Peru'] },
  { label: 'Outros', species: ['Cachorro', 'Outro'] },
]

export const ESPECIES: Especie[] = ESPECIE_GRUPOS.flatMap((g) => g.species);

export const STATUS_LIST: StatusAnimal[] = ['Vivo', 'Morto', 'Vendido', 'Doente', 'Arrendado'];

export const MOTIVOS_BAIXA: MotivoBaixa[] = [
  'Morto', 'Vendido', 'Consumo Próprio', 'Sem Alteração', 'Aguardando',
];
