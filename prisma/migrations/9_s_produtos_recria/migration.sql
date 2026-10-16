-- Reprodução: campos da recria (cio, inseminação ou monta, sêmen, registro do touro)
ALTER TABLE "reproductions" ADD COLUMN "bullRegistry" TEXT,
ADD COLUMN "heatDate" TIMESTAMP(3),
ADD COLUMN "method" TEXT,
ADD COLUMN "semenBatch" TEXT;

-- Vários produtos por lote
CREATE TABLE "lot_supplies" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "percent" DOUBLE PRECISION,
    CONSTRAINT "lot_supplies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lot_supplies_lotId_supplyId_key" ON "lot_supplies"("lotId", "supplyId");
ALTER TABLE "lot_supplies" ADD CONSTRAINT "lot_supplies_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lot_supplies" ADD CONSTRAINT "lot_supplies_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "supplies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- O suplemento que cada lote já tinha passa para a lista de produtos
INSERT INTO "lot_supplies" ("id", "lotId", "supplyId", "percent")
SELECT 'ls' || md5(random()::text || clock_timestamp()::text || l."id"), l."id", l."supplyId", l."supplyPercent"
FROM "lots" l
WHERE l."supplyId" IS NOT NULL;

ALTER TABLE "lots" DROP CONSTRAINT "lots_supplyId_fkey";
ALTER TABLE "lots" DROP COLUMN "supplyId",
DROP COLUMN "supplyPercent";
