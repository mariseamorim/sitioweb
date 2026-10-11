# PWA e responsividade

Use npm run dev (Webpack) para desenvolvimento na porta 3000. next-pwa gera o service worker, e PwaRegistration registra-o explicitamente no App Router. O manifesto usa escopo raiz, nome e ícones de Anota Aí Agro.

O plugin reduz o cache no modo de desenvolvimento. Para testar offline completo, use npm run build e npm start. A instalação em produção precisa de HTTPS; localhost também é permitido. Ao acessar por IP da rede usando HTTP no celular, o service worker pode ser bloqueado pelo navegador.

## Validação

node tests/pwa-responsive.cjs verifica 320, 375, 768, 1024 e 1440 pixels, ausência de transbordamento da página, formulários e menus. As telas privadas usam dados simulados para não depender de uma conta real. Requer Edge instalado no caminho configurado no teste.

Para verificar instalação e offline, execute contra uma versão de produção com TEST_PWA=1 e TEST_BASE_URL apontando para o servidor. O teste usa um perfil temporário, confirma o registro e controle do service worker, manifesto, ícones e critérios de instalação, e abre uma página em cache e o fallback sem internet. Nenhum registro real é criado.

O offline depende das telas e dados acessados anteriormente; módulos com suporte offline mantêm registros pendentes no aparelho. Formulários de contato e outras ações que dependem de servidor precisam de internet.
