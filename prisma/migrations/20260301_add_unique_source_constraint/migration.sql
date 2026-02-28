-- DropIndex
DROP INDEX IF EXISTS "Transaction_source_type_source_id_idx";

-- CreateIndex (unique, allows multiple NULLs in PostgreSQL)
CREATE UNIQUE INDEX "Transaction_source_type_source_id_key" ON "Transaction"("source_type", "source_id");
