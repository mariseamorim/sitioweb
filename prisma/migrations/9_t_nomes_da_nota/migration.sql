-- Nomes da nota do laticínio (quem recebe uma parte do leite) e a divisão de cada coleta
CREATE TABLE "milk_payees" (
    "id" TEXT NOT NULL,
    "pointId" TEXT,
    "farmId" TEXT,
    "name" TEXT NOT NULL,
    "producerCode" TEXT,
    "sequence" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "milk_payees_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "milk_payees_pointId_idx" ON "milk_payees"("pointId");
CREATE INDEX "milk_payees_farmId_idx" ON "milk_payees"("farmId");
ALTER TABLE "milk_payees" ADD CONSTRAINT "milk_payees_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "milk_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "milk_payees" ADD CONSTRAINT "milk_payees_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "milk_splits" (
    "id" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "milk_splits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "milk_splits_payeeId_date_key" ON "milk_splits"("payeeId", "date");
ALTER TABLE "milk_splits" ADD CONSTRAINT "milk_splits_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "milk_payees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
