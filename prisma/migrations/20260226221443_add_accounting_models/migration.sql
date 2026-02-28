-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parent_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "counterparty" TEXT,
    "supplier_id" TEXT,
    "payment_method" TEXT NOT NULL,
    "has_payment" BOOLEAN NOT NULL DEFAULT false,
    "has_receipt" BOOLEAN NOT NULL DEFAULT false,
    "has_invoice" BOOLEAN NOT NULL DEFAULT false,
    "match_status" TEXT NOT NULL DEFAULT 'unmatched',
    "business_use" BOOLEAN NOT NULL DEFAULT true,
    "tax_treatment" TEXT NOT NULL DEFAULT 'deductible',
    "tax_mode" TEXT NOT NULL DEFAULT 'mode1',
    "reason_code" TEXT,
    "invoice_type" TEXT,
    "invoice_number" TEXT,
    "tax_rate" DOUBLE PRECISION,
    "tax_amount" DOUBLE PRECISION,
    "net_amount" DOUBLE PRECISION,
    "proof_type" TEXT,
    "proof_note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "book_type" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationItem" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "internal_amount" DOUBLE PRECISION NOT NULL,
    "tax_amount" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "reason_code" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "ReconciliationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_code_key" ON "Account"("code");

-- CreateIndex
CREATE INDEX "Transaction_transaction_date_idx" ON "Transaction"("transaction_date");

-- CreateIndex
CREATE INDEX "Transaction_source_type_source_id_idx" ON "Transaction"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "Transaction_match_status_idx" ON "Transaction"("match_status");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "JournalEntry_transaction_id_idx" ON "JournalEntry"("transaction_id");

-- CreateIndex
CREATE INDEX "JournalEntry_book_type_entry_date_idx" ON "JournalEntry"("book_type", "entry_date");

-- CreateIndex
CREATE INDEX "JournalLine_entry_id_idx" ON "JournalLine"("entry_id");

-- CreateIndex
CREATE INDEX "JournalLine_account_id_idx" ON "JournalLine"("account_id");

-- CreateIndex
CREATE INDEX "ReconciliationItem_transaction_id_idx" ON "ReconciliationItem"("transaction_id");

-- CreateIndex
CREATE INDEX "ReconciliationItem_period_year_period_month_idx" ON "ReconciliationItem"("period_year", "period_month");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
