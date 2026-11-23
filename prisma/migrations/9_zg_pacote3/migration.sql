-- Meta de vacas em lactação da propriedade
ALTER TABLE "farms" ADD COLUMN "lactatingGoal" INTEGER;

-- Manejos da agenda marcados como feitos
CREATE TABLE "agenda_done" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agenda_done_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agenda_done_farmId_key_key" ON "agenda_done"("farmId", "key");
ALTER TABLE "agenda_done" ADD CONSTRAINT "agenda_done_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foto do perfil do usuário
ALTER TABLE "users" ADD COLUMN "avatar" TEXT;
