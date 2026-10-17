# Ajuda e suporte pelo WhatsApp

Só para quem está logado. O número do suporte fica no servidor e não aparece no HTML nem no JavaScript; quem não entrou no sistema continua com o formulário de contato da página inicial.

## Ativação

Adicione `SUPPORT_WHATSAPP` ao .env.local do servidor ou ao gerenciador de segredos da hospedagem, só com números e DDD (o DDI 55 entra sozinho). Não use NEXT_PUBLIC_. Sem a variável, a página Ajuda mostra apenas o e-mail e os botões de WhatsApp não aparecem.

## Onde aparece

- Menu: "Ajuda e suporte" abre a página /ajuda, com Falar com o suporte, Configuração inicial e o passo a passo de cada tela. Vale para produtor, fornecedor, laticínio e associação.
- "Como usar esta tela", dentro de cada módulo, termina com "Não resolveu? Fale com o suporte pelo WhatsApp".
- Painel de uma propriedade sem animais: cartão "Quer ajuda para começar?", com "Agora não" guardado no aparelho.

## Como funciona

Os botões apontam para `/api/suporte?kind=...&screen=...`. A rota exige sessão, monta a mensagem com nome, propriedade e tela, e redireciona para o WhatsApp. No pedido de configuração inicial (`kind=configurar`) a mensagem leva o resumo do cadastro: propriedade, cidade, o que ela faz, animais cadastrados e dias de leite anotados. Sem internet, os botões ficam desativados com o motivo.

`/api/auth/me` devolve `support: true` quando há número configurado; é só isso que o navegador sabe.

## Código

- `src/lib/support.ts`: mensagem, nome da tela, resumo do cadastro e endereço da rota.
- `src/app/api/suporte/route.ts`: a rota que redireciona.
- `src/components/SupportWhatsApp.tsx`, `SetupHelpCard.tsx`, `src/app/ajuda/page.tsx`.

```powershell
node tests/suporte.cjs
```
