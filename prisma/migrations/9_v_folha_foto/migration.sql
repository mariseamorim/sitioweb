-- Folha do carreteiro lida pela foto: temperatura, amostra, régua e a foto como prova
ALTER TABLE "milk_sheets" ADD COLUMN "temperature" DOUBLE PRECISION,
ADD COLUMN "sampleNumber" TEXT,
ADD COLUMN "rulerValue" DOUBLE PRECISION,
ADD COLUMN "photo" TEXT;
