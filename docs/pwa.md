# PWA e responsividade

Use npm run dev (Webpack) para desenvolvimento na porta 3000. next-pwa gera o service worker, e PwaRegistration registra-o explicitamente no App Router. O manifesto usa escopo raiz, nome e ícones de Anota Aí Agro.

O plugin reduz o cache no modo de desenvolvimento. Para testar offline completo, use npm run build e npm start. A instalação em produção precisa de HTTPS; localhost também é permitido. Ao acessar por IP da rede usando HTTP no celular, o service worker pode ser bloqueado pelo navegador.

## Sem internet: entrar e abrir o app

Entrar exige internet: a senha é conferida no servidor e a sessão é um cookie de 90 dias, renovado a cada uso com sinal. O que funciona sem internet é abrir o app de quem já entrou neste aparelho.

- As telas do site ficam guardadas por 90 dias na regra "telas" do service worker, em next.config.ts. Painel ("/") e Ajuda vêm prontas do servidor com dados da pessoa e esperam 3 segundos pela rede antes de usar a cópia (NetworkFirst). As demais telas são cascas que buscam os dados pela API: abrem na hora pela cópia guardada e a cópia é atualizada por trás (StaleWhileRevalidate). Isso evita a espera e a tela branca com sinal fraco, quando o celular acha que está online mas nada chega. A regra padrão do next-pwa guardava por um dia e quem ficava mais tempo sem sinal caía na tela offline.
- PwaRegistration guarda essas telas de antemão no primeiro acesso com internet e a cada 6 horas; o login e o sair refazem esse cache para quem está no aparelho.
- A cada atualização do site, o service worker novo guarda só os arquivos novos e apaga os antigos (`cleanupOutdatedCaches`). As telas guardadas antes apontam para os arquivos antigos e abririam em branco sem internet. Por isso, quando o service worker novo assume (`controllerchange`), PwaRegistration refaz todas as telas guardadas em `telas`, mais as essenciais (`refreshCachedPages`). Quem ficar sem internet entre um deploy e a próxima abertura com sinal ainda cai nesse caso.
- A tela de login sem internet avisa, desativa o botão Entrar e, se alguém já entrou neste aparelho, oferece "Continuar sem internet", que abre o app guardado.
- Entrar sem internet: ao entrar com internet, a senha fica guardada no aparelho como hash PBKDF2 com sal (src/lib/offlineUnlock.ts), nunca a senha. Sem sinal, o login confere a senha no aparelho e abre o app com os dados guardados, sem criar sessão no servidor; quando o sinal volta, a pessoa entra de novo com internet para enviar a fila. Só vale para a última pessoa que entrou neste aparelho.
- "Sair" só pergunta se quer sair e deixa dados, filas e a credencial no aparelho, sem explicar isso na hora (a sessão é de 90 dias e a explicação fica em Meu cadastro). "Sair e apagar os dados deste aparelho", em Meu cadastro, limpa tudo (para aparelho emprestado).
- O endereço inicial "/" é uma página normal para quem não usa o Painel (Anota Aí Leite, fornecedor, laticínio, associação e visitante): ela segue para a tela certa. Antes era um redirecionamento do servidor, que o service worker não consegue guardar, e o app instalado não abria sem internet. A rota especial do next-pwa para o endereço inicial foi desligada (cacheStartUrl e dynamicStartUrl false), e "/" entra na regra "telas".

## Validação

node tests/pwa-responsive.cjs verifica 320, 375, 768, 1024 e 1440 pixels, ausência de transbordamento da página, formulários e menus. As telas privadas usam dados simulados para não depender de uma conta real. Requer Edge instalado no caminho configurado no teste.

Para verificar instalação e offline, execute contra uma versão de produção com TEST_PWA=1 e TEST_BASE_URL apontando para o servidor. O teste usa um perfil temporário, confirma o registro e controle do service worker, manifesto, ícones e critérios de instalação, e abre uma página em cache e o fallback sem internet. Nenhum registro real é criado.

## Dados sem internet (src/lib/offlineData.ts)

Todas as telas usam a mesma base, que trata dois casos: sem sinal (navigator.onLine false) e sinal fraco, em que o celular acha que está online mas nada chega. Cada pedido de rede desiste em 8 segundos (`fetchWithTimeout`); sem isso, o app ficava minutos em "Carregando".

- Leitura: `cachedGet(chave, url)` busca, guarda a resposta no aparelho e, quando a rede falha (sem sinal, demora ou erro 5xx), devolve a cópia com `fromCache: true`; a tela mostra "Sinal fraco: mostrando a última cópia". Erro 4xx (sem permissão, por exemplo) não usa a cópia. O rebanho tem a própria chave, `animais_cache_<propriedade>`, por `loadHerd` em src/lib/herdCache.ts (sem a foto, para caber).
- Escrita: `sendOrQueue(modulo, { type, id?, url, method, body, local })` envia agora ou guarda na fila `pending_<modulo>`. Cada pedido guardado leva a própria URL e método (`_url`, `_method`, `_body`), então o envio é igual para todos os módulos. Recusa do servidor (4xx) volta como `rejected` com a mensagem e não entra na fila. `local` são campos só para a tela mostrar o registro enquanto espera (o animal, o farmId).
- Lista com a fila por cima: `withPending(lista, fila, build)`: `delete` tira o registro, `update` mescla o corpo no registro, `create` vira um item com id `pending_<n>` (marcado "a enviar" na tela). Excluir um item `pending_` só tira da fila.
- Envio: `syncModule(modulo)` manda a fila na ordem; enviado ou recusado (4xx: já não existe, inválido) sai da fila; falha de rede ou 5xx para e guarda o resto. A barra do topo (SyncStatus) chama `syncAll` quando a internet volta e a cada 30 s enquanto houver fila, e dispara `SYNC_EVENT` para as telas abertas recarregarem. Registros antigos da fila, sem `_url`, são enviados pela própria tela (`legacy` em `useOfflineModule`).
- Tela: `useOfflineModule(modulo, reload, legacy)` (src/lib/useOffline.ts) dá `online`, `pending`, `sync()` e recarrega quando a fila é enviada.

Filas com formato próprio, anteriores a esta base e mantidas: `estoque-mov` (movimentações com autosave), `animais` (com foto), `recria` (src/lib/rearingQueue.ts) e as do Anota Aí Leite (`lite_*`). A barra do topo conta todas; envia sozinha só as que têm `_url`.

Telas de administração e marketplace (Usuários, Propriedades, Ofertas, Fornecedor, Associação, Admin) abrem pela cópia, mas as ações (convidar, aprovar, pedir) precisam de internet: dependem da resposta do servidor.

```powershell
node tests/offline-data.cjs
```
