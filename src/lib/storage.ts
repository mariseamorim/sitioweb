import { Fazenda, Animal } from './types';

const FAZENDAS_KEY = 'fazendas';
const ANIMAIS_KEY = 'animais';

function getItem<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function setItem<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Fazendas
export function getFazendas(): Fazenda[] {
  return getItem<Fazenda>(FAZENDAS_KEY);
}

export function salvarFazenda(fazenda: Fazenda) {
  const fazendas = getFazendas();
  const index = fazendas.findIndex((f) => f.id === fazenda.id);
  if (index >= 0) {
    fazendas[index] = fazenda;
  } else {
    fazendas.push(fazenda);
  }
  setItem(FAZENDAS_KEY, fazendas);
}

export function excluirFazenda(id: string) {
  const fazendas = getFazendas().filter((f) => f.id !== id);
  setItem(FAZENDAS_KEY, fazendas);
  // Remove animais da fazenda
  const animais = getAnimais().filter((a) => a.fazendaId !== id);
  setItem(ANIMAIS_KEY, animais);
}

// Animais
export function getAnimais(): Animal[] {
  return getItem<Animal>(ANIMAIS_KEY);
}

export function getAnimaisPorFazenda(fazendaId: string): Animal[] {
  return getAnimais().filter((a) => a.fazendaId === fazendaId);
}

export function salvarAnimal(animal: Animal) {
  const animais = getAnimais();
  const index = animais.findIndex((a) => a.id === animal.id);
  if (index >= 0) {
    animais[index] = animal;
  } else {
    animais.push(animal);
  }
  setItem(ANIMAIS_KEY, animais);
}

export function excluirAnimal(id: string) {
  const animais = getAnimais().filter((a) => a.id !== id);
  setItem(ANIMAIS_KEY, animais);
}
