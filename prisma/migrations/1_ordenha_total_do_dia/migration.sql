-- Ordenha como total do dia: o registro de leite passa a pertencer à fazenda,
-- e a vaca vira opcional (vazio = total do dia, sem separar por animal).

-- AlterTable
ALTER TABLE "milk_productions" ADD COLUMN "farmId" TEXT;
ALTER TABLE "milk_productions" ADD COLUMN "cowsMilked" INTEGER;

-- Preenche a fazenda dos registros existentes a partir da vaca
UPDATE "milk_productions" m SET "farmId" = a."farmId" FROM "animals" a WHERE a."id" = m."animalId";

ALTER TABLE "milk_productions" ALTER COLUMN "farmId" SET NOT NULL;
ALTER TABLE "milk_productions" ALTER COLUMN "animalId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "milk_productions_farmId_date_idx" ON "milk_productions"("farmId", "date");

-- AddForeignKey
ALTER TABLE "milk_productions" ADD CONSTRAINT "milk_productions_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
