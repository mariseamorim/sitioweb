-- O app cadastrava a unidade como "saco" e o site como "sacos"; as contas de kg (dias para acabar, trato) só reconheciam "sacos"
UPDATE "supplies" SET "unit" = 'sacos' WHERE "unit" = 'saco';
