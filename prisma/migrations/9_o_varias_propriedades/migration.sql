-- DropIndex
DROP INDEX "farms_documentNumber_key";

-- AlterTable
ALTER TABLE "farms" ADD COLUMN     "segments" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "farm_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "farm_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "farm_members_farmId_idx" ON "farm_members"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "farm_members_userId_farmId_key" ON "farm_members"("userId", "farmId");

-- CreateIndex
CREATE INDEX "farms_documentNumber_idx" ON "farms"("documentNumber");

-- AddForeignKey
ALTER TABLE "farm_members" ADD CONSTRAINT "farm_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_members" ADD CONSTRAINT "farm_members_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Quem já tem propriedade passa a ter acesso a ela pela lista (admin do sistema vê todas sem lista)
INSERT INTO "farm_members" ("id", "userId", "farmId")
SELECT 'fm' || md5(random()::text || clock_timestamp()::text || u."id"), u."id", u."farmId"
FROM "users" u
WHERE u."farmId" IS NOT NULL AND u."role" <> 'admin'
ON CONFLICT DO NOTHING;
