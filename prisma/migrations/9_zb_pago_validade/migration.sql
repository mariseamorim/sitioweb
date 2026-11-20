-- Financeiro: lançamento pago/recebido ou em aberto (os antigos ficam como pagos)
ALTER TABLE "transactions" ADD COLUMN "paid" BOOLEAN NOT NULL DEFAULT true;
-- Estoque: validade do insumo (para "Próximos a vencer")
ALTER TABLE "supplies" ADD COLUMN "expiryDate" TIMESTAMP(3);
