# Manual de Uso dos Campos Editáveis — Anota Aí Agro (App Android)

Este manual explica **cada campo editável** do aplicativo **Anota Aí Agro** (`v1.7.0`), tela por tela, com o formato esperado, se é obrigatório ou opcional e dicas práticas de preenchimento no dia a dia da propriedade.

> **Dica geral:** Os campos de texto, seletores e datas funcionam **mesmo sem internet** na maioria das telas (os lançamentos ficam salvos no celular e sincronizam automaticamente quando o sinal voltar).

---

## 1. Acesso e Meu Cadastro

### 1.1 Entrar no Sistema (`login.tsx`)
| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **E-mail ou telefone** | Texto / E-mail / Telefone | Sim | Digite o e-mail cadastrado ou o número do celular com DDD (ex.: `(35) 99912-3456`). |
| **Senha** | Senha (ocultável) | Sim | Digite sua senha de acesso. Toque no ícone de olho para conferir o que foi digitado. |

### 1.2 Meu Cadastro (`perfil.tsx`)
| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Nome \*** | Texto | Sim | Seu nome completo ou como prefere ser identificado na propriedade. |
| **Telefone** | Telefone `(00) 00000-0000` | Opcional* | Celular com DDD. Pode ser usado para entrar no app (*informe telefone ou e-mail*). |
| **E-mail (opcional)** | E-mail | Opcional* | Endereço de e-mail válido. Também pode ser usado para entrar no app. |
| **Senha atual** | Senha | Para trocar senha | Exibido apenas se você já tiver senha. Informe a senha atual antes de definir uma nova. |
| **Nova senha** | Senha | Opcional | Mínimo de 6 caracteres. Deixe em branco se não quiser alterar a senha atual. |
| **Confirmar nova senha** | Senha | Se preencher Nova senha | Repita exatamente a nova senha para evitar erros de digitação. |

---

## 2. Propriedades (`fazendas/[id].tsx` e `fazendas/index.tsx`)

| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Tipo da propriedade** (`Sítio` / `Fazenda`) | Botões de escolha (Chips) | Sim | Define se o cadastro aparecerá como Sítio ou Fazenda. |
| **Nome \*** | Texto | Sim | Nome do sítio ou fazenda (ex.: `Sítio Primavera`). |
| **Proprietário** | Texto | Opcional | Nome completo do dono ou responsável principal. |
| **Doc. Tipo** (`CPF` / `CNPJ`) | Lista de seleção | Opcional | Escolha se o documento da propriedade/produtor é CPF ou CNPJ. |
| **Documento (CPF/CNPJ)** | Numérico com máscara | Opcional | Digite apenas os números; o app formata automaticamente conforme o tipo escolhido. |
| **Telefone** | Telefone | Opcional | Telefone de contato da propriedade com DDD. |
| **Endereço** | Texto | Opcional | Estrada, rodovia, bairro rural ou referência de localização. |
| **Cidade** | Texto | Opcional | Município onde a propriedade está localizada. |
| **Estado** | Texto (2 letras) | Opcional | Sigla do estado em maiúsculas (ex.: `MG`, `SP`). Máximo de 2 caracteres. |

---

## 3. Animais (`animais/[id].tsx`)

| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Foto do animal** | Câmera / Galeria | Opcional | Tire uma foto na hora ou escolha da galeria para identificar o animal visualmente. |
| **Nome** | Texto | Sim | Nome ou apelido do animal (ex.: `Mimosa`, `Estrela`). |
| **Espécie / categoria** | Lista de seleção | Sim | Categoria do animal (ex.: Vaca, Novilha, Bezerra, Bezerro, Touro, Boi, etc.). |
| **Sexo** | Lista de seleção | Sim | Escolha `Fêmea` ou `Macho`. |
| **Data de nascimento** | Data | Sim | Data em que o animal nasceu (não pode ser uma data futura). |
| **Situação** | Lista de seleção | Sim | Estado atual do animal (ex.: `Vivo`, `Vendido`, `Morto`, etc.). |
| **Brinco ou outro código (opcional)** | Texto (maiúsculas) | Opcional | Número do brinco, tatuagem ou registro. O número interno da propriedade é gerado automaticamente. |
| **Origem** | Lista de seleção | Sim | Como o animal entrou no rebanho (`Já existente`, `Nascimento`, `Compra`, etc.). |
| **Mãe (opcional)** | Lista com busca | Opcional | Exibido quando Origem = `Nascimento`. Permite vincular a vaca mãe cadastrada na propriedade. |
| **Castrado** | Interruptor (Switch) | Opcional | Ative se o animal for castrado. |
| **Observações** | Texto longo | Opcional | Anotações livres (raça, pelagem, histórico, temperamento). |

---

## 4. Produção de Leite (`leite/[id].tsx` e `(tabs)/leite.tsx`)

> **Salvamento automático:** Ao digitar ou falar os litros, o app salva automaticamente no aparelho após 1,5 segundo e sincroniza quando houver internet.

| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Período (filtro da lista)** | Botões de escolha | — | Na aba Leite, filtra os lançamentos por `Últimos 7 dias`, `Últimos 30 dias` ou `Este mês`. |
| **Modo de lançamento** (`Total do dia` / `Por vaca`) | Botões de escolha | Sim | `Total do dia`: soma geral da propriedade. `Por vaca`: produção individual de um animal. |
| **Data** | Data | Sim | Dia da ordenha (padrão: hoje). |
| **Litros** | Decimal | Sim | Quantidade de leite em litros (ex.: `180` ou `24,5`). Também pode ser preenchido pelo botão de voz **Falar o número**. |
| **Vacas ordenhadas (opcional)** | Número inteiro | Opcional | Aparece no modo `Total do dia`. Informe quantas vacas foram ordenhadas para calcular a média por vaca. |
| **Vaca** | Lista com busca | Sim (modo `Por vaca`) | Aparece no modo `Por vaca`. Selecione qual fêmea produziu o leite. |
| **Preço por litro (R$)** | Decimal (moeda) | Opcional | Valor pago pelo litro (ex.: `2,60`). Fica salvo no lançamento para calcular o faturamento estimado. |
| **Observações** | Texto longo | Opcional | Anotações sobre a ordenha (manhã/tarde, qualidade, ocorrências). |

---

## 5. Reprodução e Diagnóstico (`reproducao/[id].tsx`, `reproducao/index.tsx` e `diagnostico.tsx`)

### 5.1 Nova Cobertura / Editar Cobertura (`reproducao/[id].tsx`)
| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Fêmea** | Lista com busca | Sim | Selecione a vaca ou novilha que foi coberta/inseminada. |
| **Touro / Touro (nome)** | Texto | Opcional | Nome ou código do touro utilizado na cobertura ou no sêmen. |
| **Data da cobertura \*** | Data | Sim | Data em que ocorreu a inseminação ou monta. |
| **Status** | Lista de seleção | Sim | Situação atual (`Coberta`, `Prenha`, `Vazia`, `Parida`, `Aborto`). |
| **Como foi** | Lista de seleção | Opcional | Método utilizado (ex.: Inseminação Artificial, IATF, Monta natural, Repasse). |
| **Partida do sêmen** | Texto (maiúsculas) | Opcional | Código da partida/lote do sêmen (ex.: `2412-A`). |
| **Inseminador** | Texto | Opcional | Nome de quem realizou a inseminação. |
| **Registro do touro** | Texto | Opcional | Número de registro genealógico do touro (ex.: `RGD 12345`). |
| **Data do cio** | Data (limpável) | Opcional | Data em que a fêmea apresentou cio. |
| **Parto estimado** | Data (limpável) | Opcional | Previsão de nascimento da cria (calculada automaticamente ou ajustada manualmente). |
| **Data do parto** | Data (limpável) | Se Status = `Parida` | Data efetiva do nascimento da cria. |
| **Observações** | Texto longo | Opcional | Protocolo usado, escore corporal ou detalhes da cobertura. |

### 5.2 Registrar Cria ao Informar Parto (`reproducao/[id].tsx`)
| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Nova cria / Já está cadastrada** | Botões de escolha | Sim | Escolha se vai criar um novo animal agora ou vincular um já cadastrado. |
| **Qual animal é cria da {nome}?** | Lista com busca | Se já cadastrada | Selecione o animal existente que é filho(a) da matriz. |
| **Data do parto** | Data | Sim | Data em que a cria nasceu. |
| **Sexo** (`Bezerro` / `Bezerra`) | Botões de escolha | Sim (nova cria) | Define se o recém-nascido é Macho (`Bezerro`) ou Fêmea (`Bezerra`). |
| **Nome (opcional)** | Texto | Opcional | Nome da cria (se vazio, o app sugere um nome padrão). |
| **Resultado do parto** | Botões de escolha | Sim | Situação do nascimento (ex.: nascido vivo, natimorto). |

### 5.3 Diagnóstico de Gestação em Lote (`reproducao/diagnostico.tsx`)
| Controle | Tipo | Como usar |
|---|---|---|
| **Botões `✓ Prenha` / `✕ Vazia`** | Ação rápida | Lista todas as fêmeas com status `Coberta`. Toque em **Prenha** ou **Vazia** para registrar o toque/ultrassom em lote (com opção de **desfazer** na hora). |

---

## 6. Recria e Engorda (`recria/[id].tsx`, `engorda/novo.tsx`, `engorda/[id].tsx`, `src/ui/lots.tsx`)

### 6.1 Recria Individual — Um a Um (`recria/[id].tsx`)
| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Data da desmama** | Data | Sim (ao iniciar) | Data em que o bezerro(a) foi desmamado(a). |
| **Peso na desmama (kg)** | Decimal | Sim (ao iniciar) | Peso do animal na desmama em kg (ex.: `180`). |
| **Peso-alvo (kg, opcional)** | Decimal | Opcional | Meta de peso da recria (ex.: `320` para cobrir novilha ou `360` para engorda). |
| **Data (nova pesagem)** | Data | Sim | Data da pesagem de acompanhamento. |
| **Peso (kg)** | Decimal | Sim | Peso atual em kg; o app calcula automaticamente o ganho diário (GMD). |
| **Peso-alvo em kg (edição)** | Decimal | Opcional | Permite atualizar a meta de peso durante a recria. |
| **Data de saída** | Data | Ao encerrar | Data em que o animal concluiu a recria. |

### 6.2 Novo Lote de Recria ou Engorda (`engorda/novo.tsx`)
| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Nome do lote** | Texto | Sim | Identificação do lote (ex.: `Garrotes de julho`). |
| **Data de entrada** | Data | Sim | Data em que o lote iniciou a fase. |
| **Animais selecionados + Peso individual (kg)** | Lista / Decimal | Se escolher animais | Ao montar o lote com animais cadastrados, informe o peso (kg) de cada animal na tabela. |
| **Peso médio estimado (kg)** | Decimal | Se não pesar agora | Caso não informe o peso individual dos animais na entrada (ex.: `250`). |
| **Cabeças** | Número inteiro | Se lote sem lista | Quantidade total de animais no lote (quando criado só por quantidade). |
| **Peso médio de entrada (kg)** | Decimal | Se lote sem lista | Peso médio por cabeça na entrada do lote (ex.: `300`). |
| **Peso-alvo / Peso de saída desejado (kg, opcional)** | Decimal | Opcional | Meta de peso por cabeça para encerrar a recria ou engorda (ex.: `320` ou `540`). |

### 6.3 Gestão do Lote (`engorda/[id].tsx` e `src/ui/lots.tsx`)
| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Nome do lote / Data de entrada / Observações** | Texto / Data / Texto longo | Conforme edição | Permite renomear o lote, ajustar a data de entrada e anotar observações gerais. |
| **Peso desejado por cabeça (kg)** | Decimal | Opcional | Atualiza a meta de peso de saída do lote. |
| **Data / Cabeças / Peso médio (kg)** (Pesagem) | Data / Inteiro / Decimal | Sim (ao pesar) | Registra ou edita uma pesagem intermediária do lote. |
| **Produto / % ou Consumo / Kg por unidade / Preço** (Dieta) | Seleção + Decimais | Ao montar trato | Adicione um produto do estoque e informe percentual de consumo, peso do saco (kg) e preço unitário (R$). |
| **Produto / Data / Quanto foi dado (kg)** (Trato) | Seleção / Data / Decimal | Sim (ao lançar) | Registra a quantidade em kg fornecida no cocho em determinada data (ou edita um trato já lançado). |
| **Data de saída** | Data | Ao encerrar | Data de fechamento/venda do lote. |

---

## 7. Sanidade: Tratamentos e Vacinação

### 7.1 Tratamentos Veterinários (`tratamentos/[id].tsx`)
| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Animal** | Lista com busca | Sim | Selecione o animal que recebeu o medicamento. |
| **Medicamento** | Texto | Sim | Nome do remédio aplicado. |
| **Início** | Data | Sim | Data de início do tratamento. |
| **Fim (opcional)** | Data (limpável) | Opcional | Data de término do tratamento (usada como base para contar a carência). |
| **Carência do leite (dias)** | Número inteiro | Opcional | Dias após o fim do tratamento em que o leite **não** pode ir para o tanque (gera alerta na ordenha). |
| **Carência da carne (dias)** | Número inteiro | Opcional | Dias após o fim do tratamento antes do abate. |
| **Lote (opcional)** | Texto (maiúsculas) | Opcional | Número do lote do medicamento. |
| **Fabricante (opcional)** | Texto | Opcional | Laboratório fabricante do produto. |
| **Descrição** | Texto longo | Opcional | Posologia, via de aplicação ou protocolo. |
| **Observações** | Texto longo | Opcional | Evolução clínica ou anotações extras. |

### 7.2 Vacinação (`vacinas/[id].tsx` e `(tabs)/vacinas.tsx`)
| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Filtro da lista** (`Todas`, `Pendente`, `Aplicada`, `Vencida`) | Botões de escolha | — | Filtra rapidamente o calendário de vacinas. |
| **Animal** | Lista com busca | Sim | Escolha o animal a ser vacinado. |
| **Vacina** | Lista de seleção | Sim | Selecione uma vacina comum da lista ou escolha `Outra (digitar)`. |
| **Nome da vacina** | Texto | Se escolher `Outra` | Digite o nome da vacina personalizada. |
| **Data agendada** | Data | Sim | Data prevista para a aplicação (avisa quando vencer). |
| **Data da aplicação** | Data (limpável) | Opcional | Preencha quando aplicar a vacina. Deixe vazio enquanto estiver apenas agendada. |
| **Lote (opcional)** | Texto (maiúsculas) | Opcional | Lote do frasco da vacina. |
| **Fabricante (opcional)** | Texto | Opcional | Laboratório fabricante. |
| **Observações** | Texto longo | Opcional | Dose, reforço ou reações observadas. |

---

## 8. Estoque, Financeiro, Ofertas e Relatórios

### 8.1 Estoque de Insumos (`estoque/[id].tsx`)
| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Nome** | Texto | Sim | Nome do produto (ex.: `Ração 22% proteína`). |
| **Categoria** | Lista de seleção | Sim | Tipo do insumo (Ração, Sal mineral, Medicamento, Sêmen, etc.). |
| **Unidade** | Lista de seleção | Sim | Unidade de controle (`kg`, `saco`, `L`, `dose`, `unidade`). |
| **Quantidade atual** | Decimal | Ao cadastrar | Saldo inicial em estoque no momento do cadastro. |
| **Quantidade mínima** | Decimal | Opcional | Quando o saldo cair abaixo desse valor, o app avisa que está na hora de repor. |
| **Kg por unidade (opcional, para sacos)** | Decimal | Opcional | Peso de cada saco/embalagem em kg (ajuda nos cálculos de trato). |
| **Preço por unidade (R$, opcional)** | Decimal (moeda) | Opcional | Custo médio unitário para cálculo de custos do lote. |
| **Movimentação — Tipo** (`Saída (usou)` / `Entrada (comprou)`) | Botões de escolha | Sim | Define se está dando baixa por uso ou somando uma nova compra. |
| **Movimentação — Quantidade** | Decimal | Sim | Quantidade usada ou comprada na unidade do produto. |
| **Movimentação — Data** | Data | Sim | Data da entrada ou saída. |
| **Movimentação — Descrição (opcional)** | Texto | Opcional | Motivo da movimentação (ex.: `trato das vacas em lactação`). |

### 8.2 Financeiro (`financeiro/novo.tsx` e `financeiro/index.tsx`)
| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Filtros da lista** (Período e Tipo) | Botões de escolha | — | Filtra por `Este mês`, `Últimos 30 dias` ou `Últimos 90 dias` e por `Todas`, `Entradas` ou `Saídas`. |
| **Tipo** (`Saída (gasto)` / `Entrada (recebido)`) | Botões de escolha | Sim | Define se o lançamento é uma Despesa ou uma Receita. |
| **Categoria** | Lista de seleção | Sim | Classificação do lançamento (ex.: Leite, Venda de animais, Ração, Energia, Mão de obra). |
| **Valor (R$)** | Decimal (moeda) | Sim | Valor em reais (ex.: `1250,00`). |
| **Data** | Data | Sim | Data do pagamento ou recebimento. |
| **Animal vendido (opcional)** | Lista com busca | Opcional (`Receita`) | Disponível nas entradas para vincular a venda a um animal específico do rebanho. |
| **Descrição (opcional)** | Texto longo | Opcional | Detalhes da nota, comprador, fornecedor ou forma de pagamento. |

### 8.3 Ofertas e Orçamentos (`ofertas/index.tsx` e `src/ui/RequestQuote.tsx`)
| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Categoria (filtro)** | Botões de escolha | — | Filtra ofertas publicadas por categoria de produto. |
| **Procurar fornecedor** | Texto (busca) | Opcional (online) | Busque pelo nome da loja, do vendedor ou da cidade. |
| **Fornecedor** (Solicitar orçamento) | Lista de seleção | Sim | Escolha o fornecedor que receberá o pedido de cotação. |
| **Assunto** | Texto (até 120 chars) | Sim | Resumo do que precisa (ex.: `arame farpado, horário de entrega`). |
| **Mensagem** | Texto longo (até 500 chars) | Sim | Detalhe quantidades, especificações e dúvidas para o fornecedor. |

### 8.4 Relatórios (`relatorios/index.tsx`)
| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Atalhos de período** | Botões de escolha | — | Preenche rapidamente as datas (ex.: mês atual, últimos 30 dias). |
| **De / Até** | Datas | Sim | Intervalo inicial e final para gerar o relatório em PDF/CSV (recalculado offline no celular). |
| **Animal** | Lista com busca | Quando exigido | Aparece nos relatórios individuais para escolher o animal da ficha. |

---

## 9. Equipe e Administração (`usuarios/[id].tsx` e `admin/contas.tsx`)

### 9.1 Usuários da Propriedade (`usuarios/[id].tsx`)
| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Nome \*** | Texto | Sim | Nome do colaborador ou familiar. |
| **Telefone** | Telefone | Opcional* | Celular com DDD para acesso (*informe telefone ou e-mail*). |
| **E-mail (opcional)** | E-mail | Opcional* | E-mail para acesso ao app. |
| **Senha \*** | Senha | Sim (ao criar) | Senha inicial do novo usuário. |
| **Perfil** | Lista de seleção | Sim | Nível de acesso (ex.: Administrador da propriedade, Operador, Visualizador). |
| **Módulos permitidos** | Caixas de seleção (CheckGroup) | Conforme perfil | Marque quais módulos (Leite, Animais, Financeiro, etc.) o usuário pode ver ou editar. |

### 9.2 Contas (Painel Admin — `admin/contas.tsx`)
| Campo | Tipo | Obrigatório | Como preencher e para que serve |
|---|---|---|---|
| **Filtro de perfil** | Botões de escolha | — | Filtra a lista de contas por tipo de perfil. |
| **Nome \*** | Texto | Sim | Nome do titular da conta editada. |
| **Telefone** | Telefone | Opcional | Telefone com DDD da conta. |
| **E-mail** | E-mail | Opcional | E-mail da conta. |
| **Nova senha** | Senha | Opcional | Preencha apenas para redefinir a senha do usuário; deixe vazio para manter a atual. |
