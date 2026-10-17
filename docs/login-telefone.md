# Entrar com telefone; e-mail opcional

A conta precisa de pelo menos um contato: telefone ou e-mail. Os dois servem para entrar, com a mesma senha. Quem já tinha conta por e-mail continua igual.

## Regras

- Telefone guardado só com números, DDD + número (10 ou 11 dígitos), sem o 55. "(35) 99999-0000", "35 99999 0000" e "+55 35 99999-0000" são o mesmo telefone. Não repete entre contas.
- E-mail em minúsculas, único, opcional.
- Login: um campo "Telefone ou e-mail". Com "@" procura por e-mail; sem, por telefone. A rota aceita `login` ou, como antes, `email`.
- Login com Google continua exigindo e-mail. Uma conta só com telefone pode ligar o Google depois; o e-mail do Google é guardado nela se ainda estiver livre.
- Alterar telefone, e-mail ou senha em Meu cadastro pede a senha atual.

## Onde mudou

- Criar conta (propriedade, Anota Aí Leite, fornecedor, laticínio e associação): campo Telefone e e-mail opcional. No fornecedor e no laticínio, o telefone da empresa serve para entrar se a pessoa não informar outro.
- Usuários da propriedade: telefone ou e-mail ao criar; a lista mostra o contato que existir.
- Motorista do laticínio: telefone ou e-mail; a mensagem de acesso pelo WhatsApp diz com qual dos dois ele entra.
- Meu cadastro: telefone e e-mail editáveis.

## Banco

Migration `9_u_login_telefone`: e-mail opcional em `users`, `vendors` e `organizations`; telefone de `users` normalizado para só números (repetidos ficam só na conta mais antiga) e índice único.

```powershell
npx prisma migrate deploy
npx prisma generate
node tests/login-telefone.cjs
```

## Código

- `src/lib/identity.ts`: telefone, e-mail, o que foi digitado no login, rótulo do contato, validação "pelo menos um".
- `src/lib/registration.ts`: identidade do cadastro e `contactInUse`.
- `src/app/api/auth/login/route.ts`, `api/perfil`, `api/users`, `api/laticinio/motoristas`, `api/auth/google/callback`.
