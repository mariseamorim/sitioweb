-- AlterTable
ALTER TABLE "animals" ADD COLUMN     "motherId" TEXT;

-- CreateIndex
CREATE INDEX "animals_motherId_idx" ON "animals"("motherId");

-- AddForeignKey
ALTER TABLE "animals" ADD CONSTRAINT "animals_motherId_fkey" FOREIGN KEY ("motherId") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

