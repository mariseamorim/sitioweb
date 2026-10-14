-- CreateTable
CREATE TABLE "milk_sheets" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "farmId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milk_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "milk_sheets_userId_date_key" ON "milk_sheets"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "milk_sheets_farmId_date_key" ON "milk_sheets"("farmId", "date");

-- AddForeignKey
ALTER TABLE "milk_sheets" ADD CONSTRAINT "milk_sheets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_sheets" ADD CONSTRAINT "milk_sheets_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

