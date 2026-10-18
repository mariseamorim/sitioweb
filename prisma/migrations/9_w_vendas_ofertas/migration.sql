-- Vendas por oferta: contato do produtor (clique no WhatsApp) e o que virou (venda ou não); vendas registradas à mão
CREATE TABLE "offer_contacts" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "farmId" TEXT,
    "buyerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'contato',
    "source" TEXT NOT NULL DEFAULT 'clique',
    "saleValue" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION,
    "note" TEXT,
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "offer_contacts_promotionId_status_idx" ON "offer_contacts"("promotionId", "status");
CREATE INDEX "offer_contacts_farmId_idx" ON "offer_contacts"("farmId");

ALTER TABLE "offer_contacts" ADD CONSTRAINT "offer_contacts_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "offer_contacts" ADD CONSTRAINT "offer_contacts_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
