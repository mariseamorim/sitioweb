-- CreateTable
CREATE TABLE "milk_points" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'sitio',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milk_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milk_entries" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milk_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milk_points_ownerId_idx" ON "milk_points"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "milk_entries_pointId_date_key" ON "milk_entries"("pointId", "date");

-- AddForeignKey
ALTER TABLE "milk_points" ADD CONSTRAINT "milk_points_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milk_entries" ADD CONSTRAINT "milk_entries_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "milk_points"("id") ON DELETE CASCADE ON UPDATE CASCADE;

