ALTER TABLE "animals" ADD COLUMN "isCastrated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "animals" ADD COLUMN "acquisitionType" TEXT NOT NULL DEFAULT 'existente';
UPDATE "animals" SET "isCastrated" = true WHERE "species" IN ('Boi', 'Boi de engorda') AND "gender" = 'Macho';
ALTER TABLE "milk_productions" ADD COLUMN "pricePerLiter" DOUBLE PRECISION;
