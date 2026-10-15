-- AlterTable
ALTER TABLE "supplies" ADD COLUMN     "packageKg" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "lots" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'engorda',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "supplyId" TEXT,
    "supplyPercent" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_weighings" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "headCount" INTEGER NOT NULL,
    "avgWeight" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_weighings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lots_farmId_idx" ON "lots"("farmId");

-- CreateIndex
CREATE INDEX "lot_weighings_lotId_date_idx" ON "lot_weighings"("lotId", "date");

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "supplies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_weighings" ADD CONSTRAINT "lot_weighings_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

