-- AlterTable
ALTER TABLE "animals" ADD COLUMN     "lotId" TEXT;

-- AlterTable
ALTER TABLE "lots" ADD COLUMN     "targetWeight" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "animal_weighings" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "lotWeighingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_weighings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "animal_weighings_animalId_date_idx" ON "animal_weighings"("animalId", "date");

-- CreateIndex
CREATE INDEX "animal_weighings_lotWeighingId_idx" ON "animal_weighings"("lotWeighingId");

-- CreateIndex
CREATE INDEX "animals_lotId_idx" ON "animals"("lotId");

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_weighings" ADD CONSTRAINT "animal_weighings_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_weighings" ADD CONSTRAINT "animal_weighings_lotWeighingId_fkey" FOREIGN KEY ("lotWeighingId") REFERENCES "lot_weighings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

