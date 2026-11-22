-- Raça do touro na cobertura, quem aplicou a vacina, responsável pelo tratamento
ALTER TABLE "reproductions" ADD COLUMN "bullBreed" TEXT;
ALTER TABLE "vaccinations" ADD COLUMN "appliedBy" TEXT;
ALTER TABLE "veterinary_treatments" ADD COLUMN "responsible" TEXT;

-- Compra ligada a uma entrada no estoque
ALTER TABLE "transactions" ADD COLUMN "supplyMovementId" TEXT;
CREATE UNIQUE INDEX "transactions_supplyMovementId_key" ON "transactions"("supplyMovementId");
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_supplyMovementId_fkey" FOREIGN KEY ("supplyMovementId") REFERENCES "supply_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
