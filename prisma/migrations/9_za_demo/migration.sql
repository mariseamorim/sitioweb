-- Demonstração do veterinário no site: contas e propriedades fictícias, apagadas depois de 24 horas
ALTER TABLE "farms" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "farms_isDemo_createdAt_idx" ON "farms"("isDemo", "createdAt");
CREATE INDEX "users_isDemo_createdAt_idx" ON "users"("isDemo", "createdAt");
