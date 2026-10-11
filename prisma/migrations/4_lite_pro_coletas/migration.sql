-- AlterTable
ALTER TABLE "milk_productions" ADD COLUMN     "source" TEXT;

-- AlterTable
ALTER TABLE "milk_points" ADD COLUMN     "farmId" TEXT;

-- CreateIndex
CREATE INDEX "milk_points_farmId_idx" ON "milk_points"("farmId");

-- AddForeignKey
ALTER TABLE "milk_points" ADD CONSTRAINT "milk_points_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

