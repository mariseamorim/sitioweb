# Cadastro e login Google

O cadastro completo cria primeiro a conta do usuário e inicia uma sessão. Em seguida, o usuário cadastra a fazenda ou sítio. A propriedade não solicita e-mail: o e-mail pertence à conta. Cadastros interrompidos podem ser retomados após entrar.

Contas criadas pelo Google escolhem seu perfil (Agro, produtor Lite, motorista ou fornecedor) antes de concluir o cadastro. O login com e-mail e senha continua disponível.

## Configuração

1. No Google Cloud, configure a tela de consentimento e crie um cliente OAuth do tipo **Aplicativo da Web**.
2. Registre a URI de redirecionamento exata: `https://SEU-DOMINIO/api/auth/google/callback`. Para desenvolvimento: `http://localhost:3000/api/auth/google/callback`.
3. Configure no ambiente do servidor:

```dotenv
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_REDIRECT_URI=https://SEU-DOMINIO/api/auth/google/callback
```

Não use o prefixo `NEXT_PUBLIC_` nesses valores. O segredo nunca é enviado ao navegador. Sem essas variáveis, o botão Google fica oculto e o login tradicional continua funcionando.

4. Aplique as migrations pendentes (`npx prisma migrate deploy`), incluindo `7_google_login`, e gere o cliente (`npx prisma generate`). Reinicie a aplicação. O build de produção na Vercel já executa as migrations pelo script existente.
5. Se o projeto Google estiver em modo de teste, adicione os e-mails de teste na tela de consentimento antes de testar o login.

## Contas existentes

Entre com e-mail e senha e abra **Meu cadastro → Conectar conta Google**. Escolha o Google com o mesmo e-mail. A integração usa o identificador estável `sub` do Google e não vincula uma conta existente apenas por igualdade de e-mail.

Contas criadas pelo Google podem definir uma senha em Meu cadastro. Para alterar o e-mail, precisam primeiro criar uma senha. Contas com senha existente precisam informar a senha atual para alterar e-mail ou senha.

## Verificação

`node tests/auth-registration.cjs` cobre etapas de cadastro, retomada da conta, login Google, estado OAuth, PKCE, identidade verificada e vinculação de contas com serviços simulados. Não acessa contas reais nem altera o banco.

`node tests/registration-ui.cjs` verifica as telas em 375 px com APIs simuladas. Requer servidor local na porta 3458 (ou `TEST_BASE_URL`) e Edge instalado.

A confirmação completa em produção exige credenciais OAuth, migrations aplicadas e um teste real de consentimento/retorno do Google. Nesta implementação o código de autorização é trocado no servidor, com estado temporário em cookie HttpOnly e PKCE; o perfil vem do endpoint HTTPS UserInfo do Google. Tokens Google não são armazenados.

Referências oficiais: [OAuth para aplicações Web](https://developers.google.com/identity/protocols/oauth2/web-server) e [Google OpenID Connect](https://developers.google.com/identity/openid-connect/reference).
