-- Recria por animal, sem lote: entrada (desmama), saída e peso-alvo
ALTER TABLE "animals" ADD COLUMN "rearingStart" TIMESTAMP(3),
ADD COLUMN "rearingEnd" TIMESTAMP(3),
ADD COLUMN "rearingTarget" DOUBLE PRECISION;
