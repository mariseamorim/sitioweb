-- Veterinário consultor: cadastro do veterinário, fazendas que ele atende e autoria dos lançamentos de reprodução
CREATE TABLE "vet_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "crmv" TEXT,
    "city" TEXT,
    "state" TEXT,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vet_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vet_profiles_userId_key" ON "vet_profiles"("userId");
CREATE UNIQUE INDEX "vet_profiles_inviteCode_key" ON "vet_profiles"("inviteCode");

ALTER TABLE "vet_profiles" ADD CONSTRAINT "vet_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "vet_clients" (
    "id" TEXT NOT NULL,
    "vetId" TEXT NOT NULL,
    "farmId" TEXT,
    "farmName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "createdByVet" BOOLEAN NOT NULL DEFAULT false,
    "archive" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "vet_clients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vet_clients_vetId_farmId_key" ON "vet_clients"("vetId", "farmId");
CREATE INDEX "vet_clients_farmId_idx" ON "vet_clients"("farmId");

ALTER TABLE "vet_clients" ADD CONSTRAINT "vet_clients_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "vet_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vet_clients" ADD CONSTRAINT "vet_clients_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Quem anotou a cobertura e quem deu o diagnóstico de gestação (id da conta; sem chave estrangeira para o registro não sumir com a conta)
ALTER TABLE "reproductions" ADD COLUMN "createdById" TEXT;
ALTER TABLE "reproductions" ADD COLUMN "diagnosedById" TEXT;
ALTER TABLE "reproductions" ADD COLUMN "diagnosedAt" TIMESTAMP(3);

-- Agenda de visitas do veterinário (e as recomendações do relatório de visita)
CREATE TABLE "vet_visits" (
    "id" TEXT NOT NULL,
    "vetId" TEXT NOT NULL,
    "clientId" TEXT,
    "farmName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'agendada',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vet_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vet_visits_vetId_date_idx" ON "vet_visits"("vetId", "date");
CREATE INDEX "vet_visits_clientId_idx" ON "vet_visits"("clientId");

ALTER TABLE "vet_visits" ADD CONSTRAINT "vet_visits_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "vet_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vet_visits" ADD CONSTRAINT "vet_visits_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "vet_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Recibos emitidos pelo veterinário
CREATE TABLE "vet_receipts" (
    "id" TEXT NOT NULL,
    "vetId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "payer" TEXT NOT NULL,
    "payerDoc" TEXT,
    "farmName" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vet_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vet_receipts_vetId_number_key" ON "vet_receipts"("vetId", "number");

ALTER TABLE "vet_receipts" ADD CONSTRAINT "vet_receipts_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "vet_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Estoque do próprio veterinário
CREATE TABLE "vet_supplies" (
    "id" TEXT NOT NULL,
    "vetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'un',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minimum" DOUBLE PRECISION,
    "expiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vet_supplies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vet_supplies_vetId_idx" ON "vet_supplies"("vetId");

ALTER TABLE "vet_supplies" ADD CONSTRAINT "vet_supplies_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "vet_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "vet_supply_moves" (
    "id" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "farmName" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vet_supply_moves_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vet_supply_moves_supplyId_idx" ON "vet_supply_moves"("supplyId");

ALTER TABLE "vet_supply_moves" ADD CONSTRAINT "vet_supply_moves_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "vet_supplies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
