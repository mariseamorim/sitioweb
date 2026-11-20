// Dicionário espanhol do app, separado por área. Chave = texto em português exatamente como está no código.
import { common } from './common'
import { reproducao } from './reproducao'
import { consultoria } from './consultoria'
import { animais } from './animais'
import { painel } from './painel'

import { ajuda } from './ajuda'
import { sanidade } from './sanidade'
import { gestao } from './gestao'
import { engorda } from './engorda'
import { outros } from './outros'
export const es: Record<string, string> = { ...common, ...reproducao, ...consultoria, ...animais, ...painel, ...ajuda, ...sanidade, ...gestao, ...engorda, ...outros }
