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

## 🔐 Passo 3: Gerar NextAuth Secret

Execute no terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Cole o resultado em `NEXTAUTH_SECRET` no `.env.local`

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
