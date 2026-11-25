-- Estoque do veterinário: tipo do item e, para sêmen, touro, raça e partida
ALTER TABLE "vet_supplies" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'outro';
ALTER TABLE "vet_supplies" ADD COLUMN "bullName" TEXT;
ALTER TABLE "vet_supplies" ADD COLUMN "bullBreed" TEXT;
ALTER TABLE "vet_supplies" ADD COLUMN "semenBatch" TEXT;
