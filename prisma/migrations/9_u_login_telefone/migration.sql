-- Login por telefone e senha; e-mail passa a ser opcional (na conta, no fornecedor e no laticínio/associação)
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "vendors" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "organizations" ALTER COLUMN "email" DROP NOT NULL;

-- Telefone guardado só com números (DDD + número), sem o 55, para servir de login
UPDATE "users" SET "phone" = regexp_replace("phone", '\D', '', 'g') WHERE "phone" IS NOT NULL;
UPDATE "users" SET "phone" = substring("phone" from 3) WHERE "phone" IS NOT NULL AND length("phone") IN (12, 13) AND "phone" LIKE '55%';
UPDATE "users" SET "phone" = NULL WHERE "phone" IS NOT NULL AND length("phone") NOT IN (10, 11);
-- Telefone repetido: fica só na conta mais antiga; as outras entram pelo e-mail até informarem outro número
UPDATE "users" u SET "phone" = NULL
WHERE "phone" IS NOT NULL AND EXISTS (
  SELECT 1 FROM "users" o WHERE o."phone" = u."phone" AND o."id" <> u."id" AND o."createdAt" < u."createdAt"
);
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
