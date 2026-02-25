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

export type Especie =
  | 'Vaca'
  | 'Boi'
  | 'Touro'
  | 'Cavalo'
  | 'Porco'
  | 'Cachorro'
  | 'Galinha'
  | 'Galo'
  | 'Pato'
  | 'Bezerro';

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

export const ESPECIES: Especie[] = [
  'Vaca', 'Boi', 'Touro', 'Cavalo', 'Porco',
  'Cachorro', 'Galinha', 'Galo', 'Pato', 'Bezerro',
];

export const STATUS_LIST: StatusAnimal[] = ['Vivo', 'Morto', 'Vendido', 'Doente', 'Arrendado'];

export const MOTIVOS_BAIXA: MotivoBaixa[] = [
  'Morto', 'Vendido', 'Consumo Próprio', 'Sem Alteração', 'Aguardando',
];
