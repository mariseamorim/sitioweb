// Dicionário espanhol do app, separado por área. Chave = texto em português exatamente como está no código.
import { common } from './common'
import { reproducao } from './reproducao'
import { consultoria } from './consultoria'
import { animais } from './animais'
import { painel } from './painel'

export const es: Record<string, string> = { ...common, ...reproducao, ...consultoria, ...animais, ...painel }
