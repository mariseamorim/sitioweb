-- CreateTable
CREATE TABLE "org_notices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'aviso',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "eventDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tech_visits" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'solicitada',
    "scheduledFor" TIMESTAMP(3),
    "technician" TEXT,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tech_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_fees" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_fees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_notices_organizationId_createdAt_idx" ON "org_notices"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "tech_visits_organizationId_status_idx" ON "tech_visits"("organizationId", "status");

-- CreateIndex
CREATE INDEX "member_fees_organizationId_reference_idx" ON "member_fees"("organizationId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "member_fees_memberId_reference_key" ON "member_fees"("memberId", "reference");

-- AddForeignKey
ALTER TABLE "org_notices" ADD CONSTRAINT "org_notices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_visits" ADD CONSTRAINT "tech_visits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tech_visits" ADD CONSTRAINT "tech_visits_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "org_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_fees" ADD CONSTRAINT "member_fees_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_fees" ADD CONSTRAINT "member_fees_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "org_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

