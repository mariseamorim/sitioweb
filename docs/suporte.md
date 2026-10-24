# Ajuda e suporte pelo WhatsApp

Aberta para todos, inclusive quem ainda não criou a conta. O número do suporte fica no servidor e não aparece no HTML nem no JavaScript; ele só é usado no redirecionamento, na hora do clique.

## Ativação

Adicione `SUPPORT_WHATSAPP` ao .env.local do servidor ou às variáveis de ambiente da hospedagem (na Vercel, tipo Config), só com números e DDD (o DDI 55 entra sozinho). Não use NEXT_PUBLIC_. Sem a variável, os botões de WhatsApp não aparecem e, no lugar deles, a página Ajuda mostra botões de e-mail (mailto com o assunto pronto), para a tela sempre ter uma ação. A variável só vale no próximo deploy.

## Onde aparece

- Página /ajuda. Sem login: Tirar dúvidas, Não consigo entrar e Configuração inicial, com links no login, em criar conta e no rodapé da página inicial. Com login: Falar com o suporte, Configuração inicial e o passo a passo de cada tela; entra no menu como "Ajuda e suporte" para produtor, fornecedor, laticínio e associação.
- Fornecedor, laticínio e associação não têm propriedade: em vez de Configuração inicial, veem o cartão "Meus dados e senha", que abre Meu cadastro. No celular, o rodapé do painel deles tem "Cadastro" e "Ajuda", e o painel do fornecedor tem o botão "Meu cadastro" no topo.
- "Como usar esta tela", dentro de cada módulo, termina com "Não resolveu? Fale com o suporte pelo WhatsApp". A lista fica em `src/lib/pageHelp.ts`: cada tela diz o módulo que precisa estar liberado ou os perfis que a veem (o painel do fornecedor é pelo perfil; Meu cadastro, todo mundo logado).
- Painel de uma propriedade sem animais: cartão "Quer ajuda para começar?", com "Agora não" guardado no aparelho.

## Como funciona

Os botões apontam para `/api/suporte?kind=...&screen=...`. A rota é aberta. Com sessão, monta a mensagem com nome, propriedade (ou a empresa do fornecedor, ou o laticínio/associação) e tela; sem sessão, manda a mensagem genérica (`kind=conhecer`, `entrar` ou `configurar`). Depois redireciona para o WhatsApp. No pedido de configuração inicial de quem está logado, a mensagem leva o resumo do cadastro: propriedade, cidade, o que ela faz, animais cadastrados e dias de leite anotados. Sem internet, os botões ficam desativados com o motivo.

`/api/auth/me` devolve `support: true` quando há número configurado; a página /ajuda recebe essa informação do servidor para funcionar sem login.

## Código

- `src/lib/support.ts`: mensagem, nome da tela, resumo do cadastro e endereço da rota.
- `src/app/api/suporte/route.ts`: a rota que redireciona.
- `src/lib/pageHelp.ts`: passo a passo de cada tela e quem vê cada um; `src/components/PageHelp.tsx` mostra dentro do módulo.
- `src/app/ajuda/page.tsx` e `AjudaView.tsx`, `src/components/SupportWhatsApp.tsx`, `SetupHelpCard.tsx`.

```powershell
node tests/suporte.cjs
node tests/ajuda.cjs
```
