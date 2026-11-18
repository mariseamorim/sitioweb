// Dicionário espanhol, separado por área. Chave = texto em português exatamente como está no código.
import { common } from './common'
import { auth } from './auth'
import { reproducao } from './reproducao'
import { consultoria } from './consultoria'
import { animais } from './animais'
import { painel } from './painel'

export const es: Record<string, string> = { ...common, ...auth, ...reproducao, ...consultoria, ...animais, ...painel }
