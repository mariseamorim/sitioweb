# 🚀 Configuração do Banco de Dados - Vercel Postgres

## ⚡ Passo 1: Criar Banco no Vercel

1. Acesse [Vercel Dashboard](https://vercel.com/dashboard)
2. Clique em **"Storage"** no menu superior
3. Clique em **"Create Database"**
4. Escolha **"Postgres"**
5. Selecione **região** (escolha a mais próxima)
6. Clique em **"Create"**

## 📋 Passo 2: Copiar Connection String

1. Na dashboard do banco criado, copie a string em **"Postgres"** > **".env.local"**
2. Cole em `c:\dev\amorim\.env.local` na variável `DATABASE_URL`

Exemplo:
```
DATABASE_URL="postgres://default:abc123...@ep-xxx-xxx.us-east-1.postgres.vercel-storage.com/verceldb?sslmode=require"
```

## 🔐 Passo 3: Gerar o segredo da sessão

Execute no terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Cole o resultado em `SESSION_SECRET` no `.env.local` e nas variáveis de ambiente da Vercel. Sem ele o login não funciona em produção.

## 📊 Passo 4: Executar Migrations

```bash
npm install -g prisma
npx prisma migrate dev --name init
```

Isso vai:
- ✅ Conectar ao Vercel Postgres
- ✅ Criar as tabelas (Farm, User, Animal, AnimalHistory)
- ✅ Gerar o Prisma Client

## ✅ Passo 5: Verificar Conexão

```bash
npx prisma studio
```

Abre uma interface visual para ver o banco de dados.

## 🎯 Próximos Passos

- [ ] Criar componentes de UI (cards de animais)
- [ ] Implementar autenticação
- [ ] Criar formulário de cadastro de animais
- [ ] Implementar upload de imagens
- [ ] Dashboard com estatísticas

---

**Documentação:**
- [Prisma](https://www.prisma.io/docs)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [NextAuth.js](https://next-auth.js.org)

## 🧪 Ambiente de teste com dados de demonstração

Use sempre um **banco separado** do de produção (ex.: um Preview da Vercel com um banco de staging).

1. Variáveis do ambiente de teste: `DATABASE_URL` (banco de staging) e `SESSION_SECRET`.
2. Comando de build: `prisma generate && prisma migrate deploy && next build --webpack`
   (o `--webpack` é necessário enquanto o `next-pwa` estiver na configuração).
3. Depois do primeiro deploy, crie os dados de demonstração uma vez:

```bash
SEED_DEMO=1 SEED_PASSWORD="<senha forte>" DATABASE_URL="<url do banco>" node prisma/seed.mjs
```

O seed só roda com `SEED_DEMO=1` e pode ser repetido sem duplicar dados.
Em banco remoto, `SEED_PASSWORD` é obrigatória (mínimo 8 caracteres) e vale para todas as contas.
No banco local (localhost) a senha padrão é `demo1234`. A conta `admin@demo.com` só é criada com `SEED_ADMIN=1`.

| Conta | Perfil |
|---|---|
| admin@demo.com | Administrador |
| produtor@demo.com | Versão completa (Sítio Boa Vista), cliente do fornecedor |
| gerente@demo.com | Equipe do Sítio Boa Vista |
| leitor@demo.com | Só leitura no Sítio Boa Vista |
| rosa@demo.com | Versão completa com coletas do motorista |
| lite@demo.com | Anota Aí Leite, produtora |
| motorista@demo.com | Anota Aí Leite, motorista com rota |
| fornecedor@demo.com | Fornecedor aprovado (convite `DEMO2026`) |
