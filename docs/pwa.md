# PWA e responsividade

Use npm run dev (Webpack) para desenvolvimento na porta 3000. next-pwa gera o service worker, e PwaRegistration registra-o explicitamente no App Router. O manifesto usa escopo raiz, nome e ícones de Anota Aí Agro.

O plugin reduz o cache no modo de desenvolvimento. Para testar offline completo, use npm run build e npm start. A instalação em produção precisa de HTTPS; localhost também é permitido. Ao acessar por IP da rede usando HTTP no celular, o service worker pode ser bloqueado pelo navegador.

## Sem internet: entrar e abrir o app

Entrar exige internet: a senha é conferida no servidor e a sessão é um cookie de 90 dias, renovado a cada uso com sinal. O que funciona sem internet é abrir o app de quem já entrou neste aparelho.

- As telas do site (Início, Login, Painel, Anotar, offline) ficam guardadas por 90 dias na regra "telas" do service worker, em next.config.ts, com espera de 3 segundos pela rede antes de usar a cópia. A regra padrão do next-pwa guardava por um dia e quem ficava mais tempo sem sinal caía na tela offline.
- PwaRegistration guarda essas telas de antemão no primeiro acesso com internet e a cada 6 horas; o login refaz esse cache para a pessoa que entrou.
- A tela de login sem internet avisa, desativa o botão Entrar e, se alguém já entrou neste aparelho, oferece "Continuar sem internet", que abre o app guardado.
- Sair sem internet pede confirmação, porque apaga tudo e só dá para entrar de novo com sinal.
- O endereço inicial "/" é uma página normal para quem não usa o Painel (Anota Aí Leite, fornecedor, laticínio, associação e visitante): ela segue para a tela certa. Antes era um redirecionamento do servidor, que o service worker não consegue guardar, e o app instalado não abria sem internet. A rota especial do next-pwa para o endereço inicial foi desligada (cacheStartUrl e dynamicStartUrl false), e "/" entra na regra "telas".

## Validação

node tests/pwa-responsive.cjs verifica 320, 375, 768, 1024 e 1440 pixels, ausência de transbordamento da página, formulários e menus. As telas privadas usam dados simulados para não depender de uma conta real. Requer Edge instalado no caminho configurado no teste.

Para verificar instalação e offline, execute contra uma versão de produção com TEST_PWA=1 e TEST_BASE_URL apontando para o servidor. O teste usa um perfil temporário, confirma o registro e controle do service worker, manifesto, ícones e critérios de instalação, e abre uma página em cache e o fallback sem internet. Nenhum registro real é criado.

O offline depende das telas e dados acessados anteriormente; módulos com suporte offline mantêm registros pendentes no aparelho. Formulários de contato e outras ações que dependem de servidor precisam de internet.
