import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Criando dados de teste...');

  const farm = await prisma.farm.upsert({
    where: { cnpj: '00.000.000/0001-00' },
    update: {},
    create: {
      name: 'Fazenda Teste',
      cnpj: '00.000.000/0001-00',
      email: 'fazenda@teste.com',
      phone: '(11) 99999-9999',
      city: 'São Paulo',
      state: 'SP',
    },
  });

  console.log(`Fazenda criada: ${farm.name} (id: ${farm.id})`);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@fazenda.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@fazenda.com',
      password: 'admin123',
      role: 'admin',
      farmId: farm.id,
    },
  });

  console.log(`Usuário criado: ${admin.name} (${admin.email})`);
  console.log('\n--- Credenciais de teste ---');
  console.log('E-mail:  admin@fazenda.com');
  console.log('Senha:   admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
