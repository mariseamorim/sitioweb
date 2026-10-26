# Lançamento pelo WhatsApp

A pessoa manda "120 litros" para o número do Anota Aí Agro e o app anota na Produção de leite da propriedade dela, respondendo na hora. Usa a API oficial da Meta (WhatsApp Business Platform, Cloud API). Bibliotecas que usam o WhatsApp Web por trás ficam de fora: a Meta bloqueia o número.

## O que a pessoa pode mandar

- `120 litros` ou só `120`: total de hoje.
- `120 litros ontem`, `anteontem`, `24/10` ou `24/10/2026`.
- `120 litros de 8 vacas`: total com as vacas ordenhadas.
- `vaca 05 12 litros`, `#05 12 litros`, `da Mimosa 12 litros`: por animal (número, outro código ou nome, como está no app).
- Por extenso também vale: `cento e vinte litros` (mesma regra da voz).
- `ajuda`: lista os exemplos.

A conta é achada pelo telefone da mensagem (com ou sem o nono dígito). Só administrador ou editor com o módulo Leite, de uma propriedade, consegue anotar; o lançamento fica com a observação "Pelo WhatsApp (nome)" e o preço do litro da propriedade. Corrigir ou apagar é pela tela Leite.

## Configurar na Meta (uma vez, feito por você)

1. Em developers.facebook.com, crie um aplicativo do tipo Empresa e adicione o produto WhatsApp. Precisa de uma conta Meta Business.
2. Em WhatsApp > Configuração da API aparecem o **número de teste** da Meta, a **Identificação do número de telefone** (`WHATSAPP_PHONE_ID`) e um **token temporário** (24 h). Para testar sem renovar todo dia, crie um usuário do sistema no Meta Business e gere um token permanente com a permissão `whatsapp_business_messaging` (`WHATSAPP_TOKEN`).
3. Ainda em Configuração da API, em "Para", adicione o seu celular como destinatário de teste; a Meta manda um código para confirmar. O número de teste só conversa com até 5 destinatários cadastrados. Coloque esse mesmo número em `WHATSAPP_TEST_NUMBERS` (com DDD) para o app ignorar qualquer outro remetente enquanto estiver em teste.
4. Em Configurações do aplicativo > Básico, copie a **Chave secreta do aplicativo** (`WHATSAPP_APP_SECRET`). Sem ela o webhook recusa tudo: é o que garante que a chamada veio da Meta.
5. Escolha uma palavra qualquer para `WHATSAPP_VERIFY_TOKEN`.
6. Faça o deploy com as variáveis. Depois, em WhatsApp > Configuração > Webhook, informe `https://<seu site>/api/whatsapp` e a palavra do passo 5, clique em Verificar e salvar, e assine o campo **messages**.
7. Mande "ajuda" do seu celular para o número de teste. O cadastro do seu usuário no app precisa ter esse telefone (Meu cadastro).

Variáveis (só no servidor, nunca `NEXT_PUBLIC_`): `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_TEST_NUMBERS` (opcional, vírgula entre números). Sem token ou identificação, a rota responde 503 e nada acontece.

## Para sair do teste

Trocar o número de teste por um número seu (chip exclusivo, não pode estar em outro WhatsApp), verificar a empresa na Meta e tirar `WHATSAPP_TEST_NUMBERS`. Mensagens que o produtor inicia abrem uma janela de 24 h de atendimento; confira a tabela de preços atual da Meta para o Brasil antes de abrir para todo mundo.

## Como funciona

- `GET /api/whatsapp`: a verificação da Meta (`hub.verify_token`).
- `POST /api/whatsapp`: confere a assinatura `X-Hub-Signature-256` com a chave secreta, lê as mensagens de texto, trata uma a uma e responde 200. Imagem, áudio e confirmações de entrega são ignorados.
- Cada mensagem: remetente na lista de teste (se houver) → conta pelo telefone → interpretação → animal (se citado) → grava `milk_productions` → resposta. Erro no meio vira "Não consegui anotar agora".

## Código

- `src/lib/whatsapp.ts`: interpretação, telefones possíveis, quem pode anotar, casar o animal, leitura do webhook e textos das respostas (regra pura).
- `src/lib/whatsappServer.ts`: variáveis, assinatura e envio pela Graph API.
- `src/app/api/whatsapp/route.ts`: o webhook.

```powershell
node tests/whatsapp.cjs
```
