-- Plano de recria/engorda (etapas e meta), plano e valor de compra no lote, e despesa do Financeiro ligada ao lote
-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "lotId" TEXT;

-- AlterTable
ALTER TABLE "lots" ADD COLUMN     "planId" TEXT,
ADD COLUMN     "purchaseValue" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "lot_plans" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stages" JSONB NOT NULL,
    "targetWeight" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lot_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lot_plans_farmId_idx" ON "lot_plans"("farmId");

-- CreateIndex
CREATE INDEX "transactions_lotId_idx" ON "transactions"("lotId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_planId_fkey" FOREIGN KEY ("planId") REFERENCES "lot_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_plans" ADD CONSTRAINT "lot_plans_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

