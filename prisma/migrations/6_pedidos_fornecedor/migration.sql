-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "vendor_clients" ADD COLUMN     "shareStock" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "supply_requests" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "supplyId" TEXT,
    "itemName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'novo',
    "reply" TEXT,
    "replyPrice" DOUBLE PRECISION,
    "repliedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supply_requests_vendorId_status_idx" ON "supply_requests"("vendorId", "status");

-- CreateIndex
CREATE INDEX "supply_requests_farmId_status_idx" ON "supply_requests"("farmId", "status");

-- AddForeignKey
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_requests" ADD CONSTRAINT "supply_requests_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "supplies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

