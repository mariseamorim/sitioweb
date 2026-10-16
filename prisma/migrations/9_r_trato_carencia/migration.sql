-- AlterTable
ALTER TABLE "veterinary_treatments" ADD COLUMN     "meatWithdrawalDays" INTEGER,
ADD COLUMN     "milkWithdrawalDays" INTEGER;

-- AlterTable
ALTER TABLE "supplies" ADD COLUMN     "unitPrice" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "lot_feedings" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "supplyId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "suggestedKg" DOUBLE PRECISION,
    "cost" DOUBLE PRECISION,
    "movementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_feedings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lot_feedings_movementId_key" ON "lot_feedings"("movementId");

-- CreateIndex
CREATE INDEX "lot_feedings_lotId_date_idx" ON "lot_feedings"("lotId", "date");

-- AddForeignKey
ALTER TABLE "lot_feedings" ADD CONSTRAINT "lot_feedings_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_feedings" ADD CONSTRAINT "lot_feedings_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "supplies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_feedings" ADD CONSTRAINT "lot_feedings_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "supply_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

