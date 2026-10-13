-- AlterTable
ALTER TABLE "animals" ADD COLUMN     "customCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "animals_farmId_customCode_key" ON "animals"("farmId", "customCode");

