// Dicionário espanhol, separado por área. Chave = texto em português exatamente como está no código.
import { common } from './common'
import { auth } from './auth'
import { reproducao } from './reproducao'
import { consultoria } from './consultoria'
import { animais } from './animais'
import { painel } from './painel'

import { ajuda } from './ajuda'
import { componentes } from './componentes'
import { leite } from './leite'
import { sanidade } from './sanidade'
import { gestao } from './gestao'
import { engorda } from './engorda'
import { lite } from './lite'
import { dashboard } from './dashboard'
export const es: Record<string, string> = { ...common, ...auth, ...reproducao, ...consultoria, ...animais, ...painel, ...ajuda, ...componentes, ...leite, ...sanidade, ...gestao, ...engorda, ...lite, ...dashboard }
