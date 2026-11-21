// Manual do Usuário Ilustrado no aplicativo nativo (funciona 100% offline, sem sobrepor os pontos-chave das telas, e exporta PDF com expo-print).
import { Ionicons } from '@expo/vector-icons'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { API_BASE } from '@/api/client'
import { colors, font, radius, space } from '@/theme'
import { Button, Card, Muted, Screen, Title } from '@/ui'
import { TextButton } from '@/ui/TextButton'

type BlockKey =
  | 'hub'
  | 'rebanho'
  | 'acesso-e-painel'
  | 'leite-lite'
  | 'leite-e-sanidade'
  | 'gestao'
  | 'motorista-e-laticinio'
  | 'associacao-e-fornecedor'
  | 'all'

type StepBlockKey = Exclude<BlockKey, 'hub' | 'all'>

interface ScreenBlock {
  num: number
  fieldLabel: string
  fieldValue: string
  calloutLabel: string
  tone?: 'green' | 'red' | 'amber' | 'neutral'
}

interface ManualStep {
  num: string
  block: StepBlockKey
  profileBadge: string
  section: string
  title: string
  summary: string
  pageHeader: string
  pageSub: string
  blocks: ScreenBlock[]
  steps: string[]
  tip: string
}

const BLOCK_CARDS: { key: StepBlockKey; label: string; desc: string }[] = [
  { key: 'rebanho', label: 'Rebanho (Animais, Recria e Reprodução)', desc: 'Cadastro de animais, crias, recria 1 a 1, lotes de engorda, trato e IATF.' },
  { key: 'acesso-e-painel', label: 'Acesso, Painel, Offline e Dashboard TV', desc: 'Login, modo offline, painel inicial, resumo anual e Dashboard TV.' },
  { key: 'leite-lite', label: 'Anota Aí Leite', desc: 'Anotar litros digitando ou por voz, dividir a nota do tanque e folha OCR.' },
  { key: 'leite-e-sanidade', label: 'Leite Pro e Sanidade', desc: 'Produção por vaca ou total, trava de carência, vacinas e tratamentos.' },
  { key: 'gestao', label: 'Gestão (Estoque, Ofertas, Caixa e Equipe)', desc: 'Estoque mínimo, cotações, ofertas, financeiro/PDF/CSV e permissões.' },
  { key: 'motorista-e-laticinio', label: 'Motorista e Laticínio', desc: 'Rota do dia offline no celular, painel do laticínio e criação de rotas.' },
  { key: 'associacao-e-fornecedor', label: 'Associação e Fornecedor', desc: 'Compras coletivas, visitas técnicas, ofertas e pedidos de orçamento.' },
]

const FILTERS: { key: BlockKey; label: string }[] = [
  { key: 'hub', label: 'Blocos' },
  { key: 'rebanho', label: 'Rebanho' },
  { key: 'acesso-e-painel', label: 'Acesso e Painel' },
  { key: 'leite-lite', label: 'Anota Aí Leite' },
  { key: 'leite-e-sanidade', label: 'Leite e Sanidade' },
  { key: 'gestao', label: 'Gestão' },
  { key: 'motorista-e-laticinio', label: 'Motorista e Laticínio' },
  { key: 'associacao-e-fornecedor', label: 'Associação e Fornecedor' },
  { key: 'all', label: 'Todos (23)' },
]

const MANUAL_STEPS: ManualStep[] = [
  {
    num: 'Passo 1.1', block: 'acesso-e-painel', profileBadge: 'Todos os Perfis', section: '1. Primeiros Passos',
    title: 'Entrar no Sistema (Telefone com DDD, E-mail ou Google) e Criar Conta',
    summary: 'Acesse usando seu número de telefone com DDD ou e-mail, entre com Google ou crie sua conta por perfil.',
    pageHeader: 'Anota Aí Agro · Entrar', pageSub: 'Acesso por telefone (DDD) ou e-mail',
    blocks: [
      { num: 1, fieldLabel: 'Telefone ou e-mail *', fieldValue: '(35) 99912-3456', calloutLabel: 'Digite Telefone (DDD) ou E-mail', tone: 'green' },
      { num: 2, fieldLabel: 'Botão de acesso', fieldValue: '[ Entrar ]  ou  [ G  Entrar com Google ]', calloutLabel: 'Toque em Entrar ou Google', tone: 'neutral' },
      { num: 3, fieldLabel: 'Novo cadastro', fieldValue: 'Criar minha conta grátis →', calloutLabel: 'Escolha seu perfil ao criar conta', tone: 'green' },
    ],
    steps: [
      'Na tela de entrada, digite seu Telefone com DDD (ex.: 35 99912-3456) ou seu E-mail cadastrado.',
      'Informe sua senha e toque em "Entrar", ou use "Entrar com Google".',
      'Se ainda não tem cadastro, toque em "Criar conta" e escolha seu perfil.',
    ],
    tip: 'Em "Meu cadastro" você pode manter tanto o telefone quanto o e-mail salvos — os dois funcionam para entrar.',
  },
  {
    num: 'Passo 1.2', block: 'acesso-e-painel', profileBadge: 'Todos os Perfis', section: '1. Primeiros Passos',
    title: 'Uso Sem Internet (Modo Offline e Sincronização)',
    summary: 'Continue registrando leite, animais, coberturas, recria, estoque, financeiro e coletas da rota mesmo sem sinal.',
    pageHeader: 'Sincronização Offline', pageSub: 'Banco local salvo no celular',
    blocks: [
      { num: 1, fieldLabel: 'Status da conexão', fieldValue: 'Sem internet · Salvando no aparelho', calloutLabel: 'Aviso automático quando sem sinal', tone: 'amber' },
      { num: 2, fieldLabel: 'Fila local do celular', fieldValue: '2 registros aguardando envio (Na fila)', calloutLabel: 'Registros ficam guardados no celular', tone: 'amber' },
      { num: 3, fieldLabel: 'Envio automático', fieldValue: '✓ Em dia (ou botão Sincronizar agora)', calloutLabel: 'Envia sozinho quando o sinal volta', tone: 'green' },
    ],
    steps: [
      'No curral ou na estrada sem sinal, faça os lançamentos normalmente.',
      'Os registros ficam guardados no banco interno do aplicativo e já atualizam os saldos na tela.',
      'Assim que a internet voltar, tudo é sincronizado automaticamente (ou em Mais > Sincronização).',
    ],
    tip: 'Antes de sair da conta, aguarde o envio dos itens pendentes na fila.',
  },
  {
    num: 'Passo 2.1', block: 'leite-lite', profileBadge: 'Produtor Lite', section: '2. Anota Aí Leite (Gratuito)',
    title: 'Anotar o Leite do Dia (Digitando ou Falando pelo Microfone)',
    summary: 'Digite os litros ou fale pelo microfone (funciona sem internet) e acompanhe o valor estimado no mês.',
    pageHeader: 'Anota Aí Leite · Aba Anotar', pageSub: 'Sítio Primavera · Leite do dia',
    blocks: [
      { num: 1, fieldLabel: 'Leite do dia (L)', fieldValue: '48 L', calloutLabel: 'Campo para digitar os litros do dia', tone: 'green' },
      { num: 2, fieldLabel: 'Comando de voz', fieldValue: '🎙️ Falar o número (Voz offline)', calloutLabel: 'Fale a quantidade pelo microfone', tone: 'green' },
      { num: 3, fieldLabel: 'Gravação automática', fieldValue: 'Salvo · Litro a R$ 2,40 ≈ R$ 115,20', calloutLabel: 'Salva sozinho mesmo sem internet', tone: 'neutral' },
    ],
    steps: [
      'Na aba "Anotar", confira a data da ordenha.',
      'Digite os litros OU toque em "Falar o número" e diga a quantidade em voz alta.',
      'O aplicativo salva sozinho quando você para de digitar.',
      'Toque em "Alterar" ao lado do preço do litro para calcular quanto vai receber no mês.',
    ],
    tip: 'Você pode baixar o modelo de voz offline (32 MB) uma única vez no Wi-Fi para usar o microfone sem sinal.',
  },
  {
    num: 'Passo 2.2', block: 'leite-lite', profileBadge: 'Produtor Lite & Pro', section: '2. Anota Aí Leite (Gratuito)',
    title: 'Dividir a Nota do Tanque entre Mais de um Nome no Laticínio',
    summary: 'Quando dois ou mais produtores entregam leite no mesmo tanque, reparta os litros em cada coleta.',
    pageHeader: 'Anota Aí Leite · Divisão da Nota', pageSub: 'Acumulado desde a última coleta: 370,0 L',
    blocks: [
      { num: 1, fieldLabel: 'Sugestões rápidas', fieldValue: '[⚡ Como da última 60/40%]  [Igual]  [Tudo num nome]', calloutLabel: 'Divisão automática com 1 toque', tone: 'green' },
      { num: 2, fieldLabel: 'Litros por titular', fieldValue: 'João (4812): 222 L  |  Maria (4813): 148 L', calloutLabel: 'Informe os litros de cada código', tone: 'neutral' },
      { num: 3, fieldLabel: 'Confirmar divisão', fieldValue: '[ Salvar divisão (370,0 L) ]', calloutLabel: 'Salva a divisão daquela coleta', tone: 'green' },
    ],
    steps: [
      'Na aba "Nomes", cadastre quem divide o tanque (ou fotografe o cabeçalho da folha do laticínio).',
      'Na aba "Anotar", nos dias de coleta, toque em "Coleta hoje? Dividir a nota".',
      'Escolha uma sugestão rápida ou digite os litros de cada titular e salve.',
    ],
    tip: 'Com dois nomes cadastrados, ao digitar os litros de um nome o aplicativo completa o outro automaticamente.',
  },
  {
    num: 'Passo 2.3', block: 'leite-lite', profileBadge: 'Produtor Lite & Pro', section: '2. Anota Aí Leite (Gratuito)',
    title: 'Conferir a Folha do Motorista pela Foto (Leitura OCR)',
    summary: 'Tire foto da folha do carreteiro: o sistema lê litros, temperatura, amostra e régua e guarda a foto como prova.',
    pageHeader: 'Anota Aí Leite · Aba Folha', pageSub: 'Conferência da folha do motorista',
    blocks: [
      { num: 1, fieldLabel: 'Câmera / Galeria', fieldValue: '[ 📷 Fotografar a folha do motorista ]', calloutLabel: 'Tire foto do ticket/folha (OCR)', tone: 'green' },
      { num: 2, fieldLabel: 'Dados extraídos', fieldValue: 'Folha: 370 L | Temp: 3,4 °C | Amostra: 884 | Régua: 41,2', calloutLabel: 'Confira os números lidos da folha', tone: 'neutral' },
      { num: 3, fieldLabel: 'Comparação e prova', fieldValue: '[ Salvar folha ] · Alerta vermelho se divergir > 5%', calloutLabel: 'Guarda a foto junto da coleta', tone: 'red' },
    ],
    steps: [
      'Abra a aba "Folha" e toque em "Fotografar a folha".',
      'Confira os litros lidos, a temperatura, o nº da amostra e a régua.',
      'Toque em "Salvar folha" para gravar e comparar com a sua anotação do sítio.',
    ],
    tip: 'Diferenças acima de 5% entre o anotado no sítio e a folha do carreteiro ficam destacadas em vermelho no Histórico.',
  },
  {
    num: 'Passo 3.1', block: 'acesso-e-painel', profileBadge: 'Propriedade Pro', section: '3. Gestão Completa da Propriedade',
    title: 'Painel Inicial da Propriedade e Atalhos Rápidos',
    summary: 'Veja os atalhos das tarefas mais usadas do dia, troque de fazenda e navegue pelas abas inferiores.',
    pageHeader: 'Painel · Sítio Boa Vista', pageSub: 'Bem-vindo de volta, João Produtor',
    blocks: [
      { num: 1, fieldLabel: 'Topo e propriedade', fieldValue: 'Sítio Boa Vista · Sino de Tarefas (🔔)', calloutLabel: 'Troque de fazenda e veja alertas', tone: 'neutral' },
      { num: 2, fieldLabel: 'O que você quer fazer?', fieldValue: '[Anotar leite] [Cuidar do rebanho] [Dinheiro] [Estoque]', calloutLabel: 'Atalhos diretos das tarefas do dia', tone: 'green' },
      { num: 3, fieldLabel: 'Abas do aplicativo', fieldValue: 'Painel · Leite · Animais · Vacinas · Mais', calloutLabel: 'Navegação rápida no rodapé', tone: 'neutral' },
    ],
    steps: [
      'No Painel inicial, toque em uma das tarefas principais para abrir a tela correspondente.',
      'Use a aba "Mais" no rodapé para acessar todos os módulos ou trocar de propriedade.',
    ],
    tip: 'O aplicativo funciona conectado ao mesmo banco de dados do site, mantendo tudo sincronizado.',
  },
  {
    num: 'Passo 3.2', block: 'acesso-e-painel', profileBadge: 'Propriedade Pro', section: '3. Gestão Completa da Propriedade',
    title: 'Alertas do Dia (Carência / Vacinas) e Resumo Mensal e Anual',
    summary: 'Acompanhe alertas urgentes de carência, vacinas e partos e alterne entre o balanço mensal e anual.',
    pageHeader: 'Painel · Alertas & Resumo', pageSub: 'Tarefas do dia e balanço Mensal / Anual',
    blocks: [
      { num: 1, fieldLabel: 'Alertas prioritários', fieldValue: '🚫 Leite de Estrela fora do tanque até 21/11 (Carência)', calloutLabel: 'Avisos de carência, vacina e parto', tone: 'red' },
      { num: 2, fieldLabel: 'Alternar período', fieldValue: '[ Visão mensal ]  ⇄  [ ✓ Visão anual ]', calloutLabel: 'Troque entre Mensal e Anual', tone: 'green' },
      { num: 3, fieldLabel: 'Balanço consolidado', fieldValue: 'Leite: 6.420 L · Receitas: R$ 19,4k · Saldo: +R$ 11,2k', calloutLabel: 'Totais e tabela mês a mês', tone: 'neutral' },
    ],
    steps: [
      'Confira no topo os alertas vermelhos (carência de leite ou vacina vencida) e âmbar (atenção nos próximos 7 dias).',
      'Em "Resumo do período", alterne entre "Visão mensal" e "Visão anual" para ver o resultado mês a mês.',
    ],
    tip: 'Tocar em qualquer tarefa pendente abre diretamente o módulo para resolvê-la.',
  },
  {
    num: 'Passo 3.2b', block: 'acesso-e-painel', profileBadge: 'Propriedade Pro', section: '3. Gestão Completa da Propriedade',
    title: 'Dashboard para TV / Monitor (Indicadores ao Vivo)',
    summary: 'Exiba os números da fazenda em tempo real na TV do escritório ou sala de ordenha com atualização automática.',
    pageHeader: 'Dashboard TV (/dashboard)', pageSub: 'Atualização automática em tela cheia',
    blocks: [
      { num: 1, fieldLabel: 'Modo monitor', fieldValue: '[ Atualizar ]   [ Tela cheia ]', calloutLabel: 'Ative tela cheia na TV ou monitor', tone: 'green' },
      { num: 2, fieldLabel: 'Indicadores do dia', fieldValue: 'Animais no rebanho · Leite ontem · Leite no mês', calloutLabel: 'KPIs grandes visíveis à distância', tone: 'neutral' },
      { num: 3, fieldLabel: 'Alertas e caixa', fieldValue: 'Partos em 30d · Vacinas atrasadas · Saldo do mês', calloutLabel: 'Pendências urgentes em tempo real', tone: 'red' },
    ],
    steps: [
      'Abra a rota /dashboard no navegador da TV, tablet ou computador da fazenda.',
      'Toque em "Tela cheia" para destacar os cartões de rebanho, leite, reprodução, vacinas e saldo.',
      'Use "Atualizar" sempre que quiser forçar uma leitura imediata.',
    ],
    tip: 'Ideal para manter em um monitor no escritório acompanhando vacinas atrasadas e partos próximos.',
  },
  {
    num: 'Passo 3.3', block: 'rebanho', profileBadge: 'Propriedade Pro', section: '3. Gestão Completa da Propriedade',
    title: 'Cadastro de Animais, Crias da Vaca e Entrada na Recria',
    summary: 'Cadastre animais com código automático e brinco opcional, veja os filhos de cada matriz e mande bezerros para a recria.',
    pageHeader: 'Animais · Ficha e Crias', pageSub: '#07 Mimosa (Brinco BR-99412) · Vaca',
    blocks: [
      { num: 1, fieldLabel: 'Novo animal', fieldValue: '[ + Cadastrar animal ] (Código auto + Brinco)', calloutLabel: 'Cadastre animais no rebanho', tone: 'green' },
      { num: 2, fieldLabel: 'Seção Crias da vaca', fieldValue: '🐣 2 crias · Intervalo: 12,8 meses · [ + Adicionar cria ]', calloutLabel: 'Histórico materno e nova cria', tone: 'neutral' },
      { num: 3, fieldLabel: 'Desmama do bezerro', fieldValue: '#41 Faísca → [ Entrar na recria (desmama) ]', calloutLabel: 'Inicie o controle de peso na recria', tone: 'green' },
    ],
    steps: [
      'Na aba "Animais", toque em "+ Cadastrar animal" e preencha nome, brinco opcional, categoria, sexo, nascimento e foto.',
      'Abra a ficha de uma matriz para consultar todas as suas crias e o intervalo entre partos.',
      'Na ficha de um bezerro(a), toque em "Entrar na recria (desmama)" para acompanhar o ganho de peso.',
    ],
    tip: 'Marcar um macho como castrado atualiza automaticamente sua classificação para Boi de engorda.',
  },
  {
    num: 'Passo 3.4', block: 'leite-e-sanidade', profileBadge: 'Propriedade Pro', section: '3. Gestão Completa da Propriedade',
    title: 'Produção de Leite na Propriedade (Total do Dia ou Por Vaca)',
    summary: 'Lance a ordenha total do tanque ou individual por vaca, com trava automática para vacas em carência.',
    pageHeader: 'Produção de Leite', pageSub: 'Lançamento diário e preço por litro',
    blocks: [
      { num: 1, fieldLabel: 'Modalidade', fieldValue: '[ ✓ Total do dia ]   ou   [ Por vaca ]', calloutLabel: 'Escolha Total do dia ou Por vaca', tone: 'green' },
      { num: 2, fieldLabel: 'Dados da ordenha', fieldValue: '248,5 L · 16 vacas ordenhadas · R$ 2,65/L', calloutLabel: 'Informe litros, vacas e preço/L', tone: 'neutral' },
      { num: 3, fieldLabel: 'Trava de carência', fieldValue: '🚫 #15 Malhada em carência de antibiótico até 21/11', calloutLabel: 'Evita misturar leite com antibiótico', tone: 'red' },
    ],
    steps: [
      'Na aba "Leite", toque em "Anotar leite" e escolha "Total do dia" ou "Por vaca".',
      'Informe os litros, quantas vacas foram ordenhadas e o preço vigente por litro.',
      'Toque em "Salvar".',
    ],
    tip: 'Lançamentos na mesma data são somados automaticamente (ex.: ordenha da manhã + ordenha da tarde).',
  },
  {
    num: 'Passo 3.5', block: 'rebanho', profileBadge: 'Propriedade Pro', section: '3. Gestão Completa da Propriedade',
    title: 'Reprodução: Cobertura, Lotes de IATF e Diagnóstico de Prenhez',
    summary: 'Registre IA, IATF, monta ou repasse com botão "Salvar e repetir para outra fêmea" e acompanhe os 280 dias de gestação.',
    pageHeader: 'Reprodução · Cobertura & IATF', pageSub: 'Repetição rápida em lote e previsão de parto',
    blocks: [
      { num: 1, fieldLabel: 'Dados da cobertura', fieldValue: '#07 Mimosa · IATF · Touro Netuno · Sêmen PT-09 · Insem. Carlos', calloutLabel: 'Fêmea, método, touro e inseminador', tone: 'neutral' },
      { num: 2, fieldLabel: 'Modo lote de IATF', fieldValue: '[ ↻ Salvar e repetir para outra fêmea ]', calloutLabel: 'Mantém dados p/ a próxima vaca', tone: 'green' },
      { num: 3, fieldLabel: 'Diagnóstico e Parto', fieldValue: '🩺 Confirmar prenhez (#21 Pintada) · Parto em +280 dias', calloutLabel: 'Confirme prenhez e registre a cria', tone: 'amber' },
    ],
    steps: [
      'Em "Mais > Reprodução", toque em "+ Registrar" e escolha a fêmea, o tipo (IA, IATF, Monta ou Repasse), o touro e a data.',
      'Em "Mais detalhes", preencha a partida do sêmen e o nome do inseminador.',
      'Use "Salvar e repetir para outra fêmea" para lançar várias vacas seguidas no dia de IATF.',
      'Confirme a prenhez aos 60 dias e registre o parto quando nascer.',
    ],
    tip: 'Funciona 100% offline no curral.',
  },
  {
    num: 'Passo 3.6', block: 'rebanho', profileBadge: 'Propriedade Pro', section: '3. Gestão Completa da Propriedade',
    title: 'Recria Individual (Um a Um, da Desmama à 1ª Cobertura)',
    summary: 'Acompanhe o ganho de peso de cada bezerro ou novilha individualmente sem precisar criar lote.',
    pageHeader: 'Recria e Engorda · Aba Recria', pageSub: 'Acompanhamento individual um a um',
    blocks: [
      { num: 1, fieldLabel: 'Entrada na recria', fieldValue: '[ + Acompanhar um animal ] (Data e peso na desmama)', calloutLabel: 'Inicie o acompanhamento na desmama', tone: 'green' },
      { num: 2, fieldLabel: 'Desempenho individual', fieldValue: '#12 Estrela: 165 kg → 312 kg (+0,53 kg/dia · Alvo 330 kg em ~34d)', calloutLabel: 'Ganho/dia e previsão do peso-alvo', tone: 'green' },
      { num: 3, fieldLabel: 'Manejo na ficha', fieldValue: '[ ⚖️ Pesar animal ]   [ 🐄 Registrar cobertura ]', calloutLabel: 'Pese no curral ou cubra a novilha', tone: 'neutral' },
    ],
    steps: [
      'Em "Recria e engorda > aba Recria", toque em "Acompanhar um animal" e informe desmama, peso inicial e peso-alvo.',
      'A cada nova pesagem, toque em "Pesar" para atualizar o ganho médio diário (kg/dia) e a projeção de chegada ao alvo.',
      'Nas novilhas a partir de 13 meses, registre a 1ª cobertura ou dê saída da recria.',
    ],
    tip: 'Desmama, pesagens e saída da recria individual funcionam mesmo sem internet.',
  },
  {
    num: 'Passo 3.7', block: 'rebanho', profileBadge: 'Propriedade Pro', section: '3. Gestão Completa da Propriedade',
    title: 'Lotes de Recria e Engorda + Trato no Cocho (Baixa no Estoque)',
    summary: 'Gerencie lotes em grupo, defina suplemento em % do peso vivo, pese o lote e lance o trato descontando do estoque.',
    pageHeader: 'Lotes · Engorda e Cocho', pageSub: 'Lote 02 — Garrotes Pasto 4 (25 cabeças)',
    blocks: [
      { num: 1, fieldLabel: 'Evolução do lote', fieldValue: 'Peso médio: 442 kg (14,7 @) · +0,88 kg/dia · Alvo 510 kg (~77d)', calloutLabel: 'Peso médio, @ e previsão de saída', tone: 'green' },
      { num: 2, fieldLabel: 'Cálculo de suplemento', fieldValue: 'Proteinado (0,3% PV/dia) → Sugerido hoje: 33,15 kg', calloutLabel: 'Sugestão automática pelo % PV', tone: 'neutral' },
      { num: 3, fieldLabel: 'Trato no cocho', fieldValue: '[ Salvar trato: 33,0 kg (R$ 92,40) ] → Baixa no estoque', calloutLabel: 'Desconta do estoque e calcula custo', tone: 'green' },
    ],
    steps: [
      'Crie o lote informando fase (Recria ou Engorda), peso-alvo e animais (ou nº de cabeças e peso médio).',
      'Vincule os suplementos do estoque com o consumo diário em % do peso vivo.',
      'Lance as pesagens do lote e o trato no cocho (que dá baixa automática no estoque).',
    ],
    tip: 'Excluir um trato devolve automaticamente a quantidade para o saldo do estoque.',
  },
  {
    num: 'Passo 3.8', block: 'leite-e-sanidade', profileBadge: 'Propriedade Pro', section: '3. Gestão Completa da Propriedade',
    title: 'Tratamentos Veterinários (Carência) e Vacinação',
    summary: 'Registre medicamentos com dias de carência para leite/abate e controle o calendário de vacinas.',
    pageHeader: 'Sanidade · Vacinas e Tratamentos', pageSub: 'Controle de carência e doses aplicadas',
    blocks: [
      { num: 1, fieldLabel: 'Novo tratamento', fieldValue: '#15 Malhada · Antibiótico mastite', calloutLabel: 'Escolha o animal e o medicamento', tone: 'neutral' },
      { num: 2, fieldLabel: 'Período de carência', fieldValue: 'Carência leite: 4 dias (até 21/11) | Abate: 14 dias', calloutLabel: 'Ativa trava de segurança no tanque', tone: 'red' },
      { num: 3, fieldLabel: 'Baixa de vacinação', fieldValue: '💉 Brucelose (#12 Estrela) → [ Registrar aplicação hoje ]', calloutLabel: 'Informe data aplicada e lote', tone: 'amber' },
    ],
    steps: [
      'Em "Tratamentos", registre o medicamento e os dias de carência para leite e para carne/abate.',
      'Em "Vacinas", agende vacinas futuras e dê baixa quando aplicar informando lote e fabricante.',
    ],
    tip: 'Enquanto a carência estiver ativa, o animal fica destacado em vermelho no Painel e na Produção de Leite.',
  },
  {
    num: 'Passo 3.9', block: 'gestao', profileBadge: 'Propriedade Pro', section: '3. Gestão Completa da Propriedade',
    title: 'Estoque de Insumos, Duração em Dias e Pedido de Orçamento',
    summary: 'Controle entradas e saídas de ração, sal e remédios, veja em quantos dias o suplemento acaba e peça orçamento.',
    pageHeader: 'Estoque de Insumos', pageSub: 'Saldo, consumo dos lotes e cotação',
    blocks: [
      { num: 1, fieldLabel: 'Item abaixo do mínimo', fieldValue: 'Ração 22% (Saldo: 40 kg / Mín: 100 kg) · [ Pedir orçamento ]', calloutLabel: 'Peça cotação ao fornecedor', tone: 'red' },
      { num: 2, fieldLabel: 'Previsão pelos lotes', fieldValue: '⏳ Proteinado Águas: lotes usam 33 kg/dia → Acaba em 5 dias', calloutLabel: 'Calcula quantos dias de estoque restam', tone: 'amber' },
      { num: 3, fieldLabel: 'Movimentação rápida', fieldValue: '[ + Entrada / Saída ] · Atualiza o saldo na hora', calloutLabel: 'Lance compras ou usos manuais', tone: 'green' },
    ],
    steps: [
      'Cadastre seus insumos com categoria, unidade, peso do saco (kg), preço unitário e estoque mínimo.',
      'Abra um produto para lançar entradas (compras) ou saídas (usos).',
      'Toque em "Pedir orçamento" nos itens com estoque baixo para cotar com seus fornecedores.',
    ],
    tip: 'Os tratos lançados nos lotes descontam o suplemento do estoque automaticamente.',
  },
  {
    num: 'Passo 3.10', block: 'gestao', profileBadge: 'Propriedade Pro', section: '3. Gestão Completa da Propriedade',
    title: 'Ofertas de Fornecedores (Destaque para Estoque Baixo e WhatsApp)',
    summary: 'Veja em primeiro lugar as promoções dos itens que estão acabando no seu estoque e chame o vendedor no WhatsApp.',
    pageHeader: 'Ofertas de Fornecedores', pageSub: 'Insumos dos seus fornecedores e da região',
    blocks: [
      { num: 1, fieldLabel: 'Cruzamento com estoque', fieldValue: '⚠️ Estoque baixo em Ração e Sal mineral (aparecem primeiro)', calloutLabel: 'Destaca o que você precisa repor', tone: 'amber' },
      { num: 2, fieldLabel: 'Oferta em destaque', fieldValue: 'Sal mineral 30 kg — R$ 119,90/saco (Casa da Ração Boa Safra)', calloutLabel: 'Preço, validade e fornecedor', tone: 'green' },
      { num: 3, fieldLabel: 'Contato direto', fieldValue: '[ 📲 Chamar no WhatsApp ]  |  Aba Meus pedidos', calloutLabel: 'Fale com o vendedor com 1 toque', tone: 'green' },
    ],
    steps: [
      'Acesse "Mais > Ofertas" para ver as promoções ativas da sua região.',
      'Toque em "Chamar no WhatsApp" para negociar direto com o fornecedor ou acompanhe os orçamentos respondidos em "Meus pedidos".',
    ],
    tip: 'Você pode vincular novos fornecedores usando o código de convite deles.',
  },
  {
    num: 'Passo 3.11', block: 'gestao', profileBadge: 'Propriedade Pro', section: '3. Gestão Completa da Propriedade',
    title: 'Financeiro (Online/Offline) e Exportação de Relatórios em PDF e CSV',
    summary: 'Controle receitas e despesas da propriedade e compartilhe relatórios completos em PDF ou planilha CSV.',
    pageHeader: 'Financeiro & Relatórios', pageSub: 'Fluxo de caixa e exportação PDF/CSV',
    blocks: [
      { num: 1, fieldLabel: 'Resumo do caixa', fieldValue: 'Receitas: R$ 19.400 | Despesas: R$ 8.150 | Saldo: +R$ 11.250', calloutLabel: 'Totais do período escolhido', tone: 'green' },
      { num: 2, fieldLabel: 'Novo lançamento', fieldValue: '[ + Anotar entrada ou saída ] (Funciona offline)', calloutLabel: 'Registre receitas e despesas', tone: 'neutral' },
      { num: 3, fieldLabel: 'Exportar relatórios', fieldValue: '[ ⬇ Baixar / Compartilhar PDF ]   [ 📊 Planilha CSV ]', calloutLabel: 'Gere PDF ou Excel pelo celular', tone: 'green' },
    ],
    steps: [
      'Em "Financeiro", lance Receitas e Despesas por categoria.',
      'Em "Relatórios", escolha o relatório (Leite, Rebanho, Vacinas, Financeiro, Partos, Estoque) e o período.',
      'Toque em "PDF" ou "CSV" para gerar e compartilhar pelo WhatsApp ou salvar no aparelho.',
    ],
    tip: 'A geração de PDF e CSV no aplicativo funciona mesmo sem internet usando os dados sincronizados no celular!',
  },
  {
    num: 'Passo 3.12', block: 'gestao', profileBadge: 'Propriedade Pro', section: '3. Gestão Completa da Propriedade',
    title: 'Equipe da Propriedade e Permissões por Módulo',
    summary: 'Cadastre funcionários, familiares ou técnicos e escolha quais módulos cada pessoa pode acessar.',
    pageHeader: 'Usuários e Permissões', pageSub: 'Controle de acesso da equipe',
    blocks: [
      { num: 1, fieldLabel: 'Perfil do usuário', fieldValue: 'Carlos Gerente · Papel: [ Editor ] (ou Admin / Leitor)', calloutLabel: 'Escolha Admin, Editor ou Leitor', tone: 'neutral' },
      { num: 2, fieldLabel: 'Módulos liberados', fieldValue: '☑️ Animais  ☑️ Leite  ☑️ Reprodução  ⬜ Financeiro (Oculto)', calloutLabel: 'Marque só os módulos permitidos', tone: 'green' },
      { num: 3, fieldLabel: 'Salvar acesso', fieldValue: '[ Salvar usuário e permissões ]', calloutLabel: 'Aplica as permissões imediatamente', tone: 'green' },
    ],
    steps: [
      'Em "Mais > Usuários", toque em "+ Novo usuário" e informe nome, telefone (ou e-mail) e senha.',
      'Escolha o papel (Administrador, Editor ou Leitor) e marque os módulos autorizados.',
    ],
    tip: 'Módulos desmarcados não aparecem no menu nem nos resumos daquele usuário.',
  },
  {
    num: 'Passo 4.1', block: 'motorista-e-laticinio', profileBadge: 'Motorista', section: '4. Guia do Motorista / Carreteiro',
    title: 'Rota do Dia no Celular do Motorista (Funciona Sem Internet)',
    summary: 'Veja as paradas na ordem da linha, instruções de porteira/acesso, anote litros por voz ou marque "Não coletado".',
    pageHeader: 'Rota de Hoje · Rota do Ipê', pageSub: 'Coleta em campo sem precisar de sinal',
    blocks: [
      { num: 1, fieldLabel: 'Parada 1 · Sítio Ipê', fieldValue: 'Litros: [ 142 L ]   [ 🎙️ Falar ]', calloutLabel: 'Digite ou fale os litros coletados', tone: 'green' },
      { num: 2, fieldLabel: 'Contato e acesso', fieldValue: 'Seu João (35) 96666-1111 · Porteira c/ cadeado, chave vizinho', calloutLabel: 'Telefone e instruções de porteira', tone: 'amber' },
      { num: 3, fieldLabel: 'Parada sem coleta', fieldValue: 'Sítio Bela Vista → [ Não coletado (informar motivo) ]', calloutLabel: 'Registre motivo se não coletou', tone: 'red' },
    ],
    steps: [
      'Ao abrir o app, confira as paradas da "Rota de hoje" na ordem da linha.',
      'Consulte telefone e instruções de acesso de cada propriedade.',
      'Digite ou fale os litros coletados (salva sozinho mesmo sem internet) ou toque em "Não coletado" informando o motivo.',
    ],
    tip: 'Assim que o celular tiver sinal, todas as coletas da rota sobem automaticamente para o laticínio.',
  },
  {
    num: 'Passo 5.1', block: 'motorista-e-laticinio', profileBadge: 'Laticínio', section: '5. Guia do Laticínio e Rotas',
    title: 'Painel do Laticínio: Pontos, Rotas, Motoristas e Recebido × Coletado',
    summary: 'Acompanhe paradas pendentes do dia em tempo real e compare o volume coletado nas rotas com o recebido na plataforma.',
    pageHeader: 'Laticínio Serra Verde', pageSub: 'Painel do laticínio',
    blocks: [
      { num: 1, fieldLabel: 'Cartões de menu', fieldValue: '[Hoje: 2 pendentes] [Rotas: 1] [Pontos: 3] [Motoristas: 1]', calloutLabel: 'Menu rápido de toda a operação', tone: 'green' },
      { num: 2, fieldLabel: 'Conferência de volume', fieldValue: 'Coletado: 4.652 L  ×  Recebido na plataforma: 1.876 L', calloutLabel: 'Compare Coletado na Rota × Recebido', tone: 'neutral' },
      { num: 3, fieldLabel: 'Andamento de hoje', fieldValue: 'Rota do Ipê: 1. Sítio Ipê (142 L Coletado) · 2. Bela Vista (Pendente)', calloutLabel: 'Status das paradas em tempo real', tone: 'amber' },
    ],
    steps: [
      'Cadastre seus "Pontos de coleta" (sítios e tanques) e seus "Motoristas".',
      'Acompanhe em "Hoje" quais paradas já foram visitadas e eventuais motivos de não coleta.',
      'Em "Recebido", lance a litragem descarregada no laticínio para conferir com a soma da rota.',
    ],
    tip: 'Vincular o ponto de coleta à propriedade do produtor faz as coletas aparecerem automaticamente para ele.',
  },
  {
    num: 'Passo 5.2', block: 'motorista-e-laticinio', profileBadge: 'Laticínio & Motorista', section: '5. Guia do Laticínio e Rotas',
    title: 'Criar e Organizar a Rota de Coleta (Dias da Semana, Motorista e Paradas)',
    summary: 'Crie cada linha de coleta definindo o nome da rota, os dias da semana, o motorista responsável e a sequência das paradas.',
    pageHeader: 'Laticínio · Rotas > + Nova rota', pageSub: 'Configuração de dias, motorista e paradas',
    blocks: [
      { num: 1, fieldLabel: 'Nome e Dias da Semana', fieldValue: 'Rota Córrego Fundo · Dias: [✓ Seg] [✓ Qua] [✓ Sex]', calloutLabel: 'Defina nome e dias em que a rota roda', tone: 'green' },
      { num: 2, fieldLabel: 'Motorista da linha', fieldValue: 'Motorista: Zé Motorista (Caminhão ABC-1D23)', calloutLabel: 'Vincule o carreteiro responsável', tone: 'neutral' },
      { num: 3, fieldLabel: 'Sequência das paradas', fieldValue: '1. Sítio Ipê [▲ ▼ ✕] · 2. Sítio Bela Vista [▲ ▼ ✕] · [Salvar rota]', calloutLabel: 'Ordene as paradas com ▲ ▼ e salve', tone: 'green' },
    ],
    steps: [
      'No painel do Laticínio, toque no cartão "Rotas" e depois em "+ Nova rota".',
      'Digite o "Nome da rota *" e toque nos dias da semana (Dom, Seg, Ter, Qua, Qui, Sex, Sáb) em que o caminhão passa.',
      'Selecione o "Motorista" responsável pela linha.',
      'Adicione os pontos em "+ Adicionar parada", ajuste a ordem de visita com as setas ▲ e ▼ e toque em "Salvar rota".',
    ],
    tip: 'O motorista independente (sem laticínio) também cria e ordena seus locais diretamente na aba "Rota" do Anota Aí Leite.',
  },
  {
    num: 'Passo 6.1', block: 'associacao-e-fornecedor', profileBadge: 'Associação', section: '6. Guia da Associação / Cooperativa',
    title: 'Painel da Associação: Compras Coletivas, Visitas Técnicas, Mensalidades e Avisos',
    summary: 'Reúna pedidos de associados em compras coletivas, agende assistência técnica, controle mensalidades e envie comunicados.',
    pageHeader: 'Associação Serra Verde', pageSub: 'Painel da associação · 54 associados',
    blocks: [
      { num: 1, fieldLabel: 'Compras coletivas', fieldValue: '🛒 Farelo de Soja 46%: 18 pedidos → Total: 420 sacos', calloutLabel: 'Soma automática dos pedidos', tone: 'green' },
      { num: 2, fieldLabel: 'Assistência técnica', fieldValue: '🩺 Visita agendada: Sítio Boa Vista (22/11 · Dr. Henrique)', calloutLabel: 'Agende visitas e registre laudos', tone: 'neutral' },
      { num: 3, fieldLabel: 'Avisos e mensalidades', fieldValue: '📢 Curso Qualidade do Leite (28/11) · 💳 48/54 mensalidades pagas', calloutLabel: 'Avisos aparecem no sino do associado', tone: 'amber' },
    ],
    steps: [
      'Compartilhe o link de convite da associação no WhatsApp para vincular os produtores.',
      'Abra "Compras coletivas" com prazo para os associados fazerem seus pedidos pelo celular.',
      'Gerencie "Assistência técnica", "Mensalidades" e publique "Comunicados" de reuniões e campanhas.',
    ],
    tip: 'Comunicados e avisos de mensalidade da associação aparecem automaticamente no sino do produtor.',
  },
  {
    num: 'Passo 7.1', block: 'associacao-e-fornecedor', profileBadge: 'Fornecedor', section: '7. Guia do Fornecedor de Insumos',
    title: 'Painel do Fornecedor: Ofertas, Orçamentos, Clientes e Vendas no Mês',
    summary: 'Publique ofertas para a região, responda cotações de produtores com estoque baixo e confirme vendas vindas do WhatsApp.',
    pageHeader: 'Casa da Ração Boa Safra', pageSub: 'Painel do fornecedor',
    blocks: [
      { num: 1, fieldLabel: 'Resumo do painel', fieldValue: '[Pedidos novos: 2] [Precisando repor: 1] [Vendas no mês]', calloutLabel: 'Orçamentos e clientes c/ estoque baixo', tone: 'amber' },
      { num: 2, fieldLabel: 'Carteira de clientes', fieldValue: '[ + Convidar clientes ] (Envia link exclusivo no WhatsApp)', calloutLabel: 'Fidelize produtores da sua região', tone: 'green' },
      { num: 3, fieldLabel: 'Orçamentos e conversão', fieldValue: '[ Responder ] [ WhatsApp ] · Confirmar: [✓ Virou venda]', calloutLabel: 'Responda cotações e meça conversão', tone: 'green' },
    ],
    steps: [
      'Em "Ofertas ativas", publique promoções escolhendo o alcance (Meus clientes ou Produtores da região).',
      'Em "Pedidos novos", responda os orçamentos solicitados pelos produtores.',
      'Em "Vendas no mês", confirme quais cliques no WhatsApp viraram venda, lance vendas manuais e veja o ranking das ofertas campeãs.',
    ],
    tip: 'Produtores com estoque baixo na categoria da sua oferta recebem um alerta destacando sua promoção.',
  },
]

export default function ManualScreen() {
  const params = useLocalSearchParams<{ bloco?: string }>()
  const [block, setBlock] = useState<BlockKey>('hub')
  const [query, setQuery] = useState('')
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    const b = params.bloco
    if (b && FILTERS.some(f => f.key === b)) setBlock(b as BlockKey)
  }, [params.bloco])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (block === 'hub' && !q) return []
    return MANUAL_STEPS.filter(s => {
      const okBlock = block === 'all' || block === 'hub' || s.block === block
      const hay = `${s.title} ${s.summary} ${s.section} ${s.steps.join(' ')}`.toLowerCase()
      return okBlock && (!q || hay.includes(q))
    })
  }, [block, query])

  async function exportarPdfManual() {
    const listToPrint = filtered.length > 0 ? filtered : MANUAL_STEPS
    try {
      setPrinting(true)
      const htmlSteps = listToPrint.map((s, idx) => `
        <div style="border:1px solid #d1d5db;border-radius:12px;padding:14px;margin-bottom:14px;page-break-inside:avoid;">
          <div style="font-size:11px;color:#15803d;font-weight:700;">${s.num} · ${s.profileBadge} · ${s.section}</div>
          <h2 style="font-size:16px;margin:4px 0 6px;color:#111827;">${idx + 1}. ${s.title}</h2>
          <p style="font-size:12px;color:#4b5563;margin:0 0 10px;">${s.summary}</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:10px;">
            <div style="font-size:12px;font-weight:700;color:#14532d;margin-bottom:6px;">📱 Tela: ${s.pageHeader} (${s.pageSub})</div>
            ${s.blocks.map(b => `<div style="font-size:11.5px;margin-bottom:4px;"><strong>[${b.num}] ${b.calloutLabel}:</strong> ${b.fieldLabel} → <code>${b.fieldValue}</code></div>`).join('')}
          </div>
          <ol style="margin:0 0 8px 18px;padding:0;font-size:12px;color:#111827;">
            ${s.steps.map(st => `<li style="margin-bottom:4px;">${st}</li>`).join('')}
          </ol>
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:8px;font-size:11.5px;color:#14532d;">
            <strong>Dica:</strong> ${s.tip}
          </div>
        </div>
      `).join('')

      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
        body { font-family: Helvetica, Arial, sans-serif; margin: 24px; color: #111827; }
        h1 { font-size: 22px; color: #14532d; margin: 0 0 4px; }
      </style></head><body>
        <h1>Manual do Usuário Ilustrado — Anota Aí Agro</h1>
        <p style="font-size:12px;color:#4b5563;margin-bottom:16px;">Guia completo passo a passo para Produtor, Motorista, Laticínio, Associação e Fornecedor.</p>
        ${htmlSteps}
      </body></html>`

      const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Manual do Usuário — Anota Aí Agro' })
      } else {
        Alert.alert('PDF gerado', uri)
      }
    } catch (e) {
      Alert.alert('Não foi possível gerar o PDF', e instanceof Error ? e.message : 'Tente novamente.')
    } finally {
      setPrinting(false)
    }
  }

  const webHref = block !== 'hub' && block !== 'all' ? `${API_BASE}/manual/bloco-${block}.html` : `${API_BASE}/manual-usuario.html`

  return (
    <Screen>
      <Title sub="Escolha apenas o bloco que precisa consultar (ex.: Rebanho) com telas guiadas e marcadores fora dos campos.">
        Manual do usuário por blocos
      </Title>

      <Card>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Button label={filtered.length > 0 && block !== 'all' ? 'Baixar PDF deste bloco' : 'Baixar / Compartilhar PDF'} onPress={() => void exportarPdfManual()} loading={printing} style={{ flex: 1 }} />
        </View>
        <TextButton label="Abrir versão Web deste bloco no navegador" onPress={() => void Linking.openURL(webHref)} />
      </Card>

      <View style={{ marginBottom: space.md }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar passo (ex: animais, recria, rota, folha, IATF, vacina)..."
          placeholderTextColor={colors.muted}
          style={styles.search}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: space.xs }}>
          {FILTERS.map(f => {
            const active = block === f.key
            return (
              <Pressable key={f.key} onPress={() => setBlock(f.key)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {block === 'hub' && !query.trim() ? (
        <View style={{ gap: space.sm, marginBottom: space.lg }}>
          {BLOCK_CARDS.map(c => (
            <Card key={c.key} onPress={() => setBlock(c.key)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: font.md, fontWeight: '700', color: colors.text }}>{c.label}</Text>
                  <Muted style={{ fontSize: 12, marginTop: 2 }}>{c.desc}</Muted>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.green} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {filtered.map((step, index) => (
        <Card key={step.num} style={{ marginBottom: space.lg }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.xs }}>
            <View style={styles.badge}><Text style={styles.badgeText}>{step.num}</Text></View>
            <View style={styles.profileBadge}><Text style={styles.profileBadgeText}>{step.profileBadge}</Text></View>
          </View>
          <Muted style={{ fontSize: 12, marginBottom: 2 }}>{step.section}</Muted>
          <Text style={styles.stepTitle}>{index + 1}. {step.title}</Text>
          <Text style={styles.stepSummary}>{step.summary}</Text>

          {/* Moldura da Tela Real + Coluna Lateral de Identificação Sem Sobreposição */}
          <View style={styles.phoneFrame}>
            <View style={styles.phoneHeader}>
              <Ionicons name="phone-portrait-outline" size={16} color={colors.white} />
              <View style={{ flex: 1 }}>
                <Text style={styles.phoneHeaderTitle}>{step.pageHeader}</Text>
                <Text style={styles.phoneHeaderSub}>{step.pageSub}</Text>
              </View>
            </View>

            <View style={styles.phoneBody}>
              {step.blocks.map(b => {
                const bg = b.tone === 'green' ? colors.greenSoft : b.tone === 'red' ? colors.redSoft : b.tone === 'amber' ? colors.amberSoft : colors.white
                return (
                  <View key={b.num} style={{ marginBottom: space.sm }}>
                    {/* Campo da tela contornado por moldura vermelha sem nada cobrindo o texto */}
                    <View style={[styles.highlightBox, { backgroundColor: bg }]}>
                      <Text style={styles.fieldLabel}>{b.fieldLabel}</Text>
                      <Text style={styles.fieldValue}>{b.fieldValue}</Text>
                    </View>
                    {/* Identificação numerada posicionada FORA do campo, logo abaixo com linha-guia */}
                    <View style={styles.externalCalloutRow}>
                      <View style={styles.leaderLine} />
                      <View style={styles.calloutPill}>
                        <View style={styles.calloutCircle}><Text style={styles.calloutNum}>{b.num}</Text></View>
                        <Text style={styles.calloutText}>{b.calloutLabel}</Text>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>

          <Text style={styles.sectionHeader}>COMO FAZER PASSO A PASSO:</Text>
          {step.steps.map((inst, i) => (
            <View key={inst} style={styles.instRow}>
              <View style={styles.instCircle}><Text style={styles.instNum}>{i + 1}</Text></View>
              <Text style={styles.instText}>{inst}</Text>
            </View>
          ))}

          <View style={styles.tipBox}>
            <Text style={styles.tipText}><Text style={{ fontWeight: '700' }}>💡 Dica prática: </Text>{step.tip}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  )
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: font.sm,
    color: colors.text,
    marginBottom: space.xs,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  chipText: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text,
  },
  chipTextActive: {
    color: colors.white,
  },
  badge: {
    backgroundColor: colors.greenDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  profileBadge: {
    backgroundColor: colors.greenSoft,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  profileBadgeText: {
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: '700',
  },
  stepTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  stepSummary: {
    fontSize: font.sm,
    color: colors.muted,
    marginTop: 4,
    marginBottom: space.md,
    lineHeight: 20,
  },
  phoneFrame: {
    borderWidth: 3,
    borderColor: '#1e293b',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    marginBottom: space.md,
  },
  phoneHeader: {
    backgroundColor: colors.green,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  phoneHeaderTitle: {
    color: colors.white,
    fontSize: font.sm,
    fontWeight: '700',
  },
  phoneHeaderSub: {
    color: colors.greenSoft,
    fontSize: 11,
  },
  phoneBody: {
    padding: space.md,
  },
  highlightBox: {
    borderWidth: 2,
    borderColor: colors.red,
    borderRadius: radius.md,
    padding: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.text,
  },
  externalCalloutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingLeft: 10,
  },
  leaderLine: {
    width: 14,
    height: 2,
    backgroundColor: colors.red,
  },
  calloutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    borderWidth: 1.5,
    borderColor: colors.red,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
    paddingLeft: 4,
  },
  calloutCircle: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calloutNum: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  calloutText: {
    color: colors.white,
    fontSize: 11.5,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: space.sm,
  },
  instRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: space.xs,
  },
  instCircle: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  instNum: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
  },
  instText: {
    flex: 1,
    fontSize: font.sm,
    color: colors.text,
    lineHeight: 20,
  },
  tipBox: {
    backgroundColor: colors.greenSoft,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.xs,
  },
  tipText: {
    fontSize: font.sm,
    color: colors.greenDark,
    lineHeight: 20,
  },
})
