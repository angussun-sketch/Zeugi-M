-- CreateTable
CREATE TABLE "FundAccount" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_type" TEXT NOT NULL DEFAULT 'cash',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashflowCategory" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "group_name" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_code" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashflowCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashflowRecord" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "fund_account_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "record_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "recurring_cashflow_id" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashflowRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringCashflow" (
    "id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "fund_account_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "due_day" INTEGER NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_generated" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringCashflow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FundAccount_org_id_idx" ON "FundAccount"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "FundAccount_org_id_name_key" ON "FundAccount"("org_id", "name");

-- CreateIndex
CREATE INDEX "CashflowCategory_org_id_idx" ON "CashflowCategory"("org_id");

-- CreateIndex
CREATE INDEX "CashflowCategory_direction_idx" ON "CashflowCategory"("direction");

-- CreateIndex
CREATE UNIQUE INDEX "CashflowCategory_org_id_direction_group_name_name_key" ON "CashflowCategory"("org_id", "direction", "group_name", "name");

-- CreateIndex
CREATE INDEX "CashflowRecord_entity_id_idx" ON "CashflowRecord"("entity_id");

-- CreateIndex
CREATE INDEX "CashflowRecord_category_id_idx" ON "CashflowRecord"("category_id");

-- CreateIndex
CREATE INDEX "CashflowRecord_fund_account_id_idx" ON "CashflowRecord"("fund_account_id");

-- CreateIndex
CREATE INDEX "CashflowRecord_record_date_idx" ON "CashflowRecord"("record_date");

-- CreateIndex
CREATE INDEX "CashflowRecord_direction_idx" ON "CashflowRecord"("direction");

-- CreateIndex
CREATE INDEX "CashflowRecord_recurring_cashflow_id_idx" ON "CashflowRecord"("recurring_cashflow_id");

-- CreateIndex
CREATE INDEX "RecurringCashflow_entity_id_idx" ON "RecurringCashflow"("entity_id");

-- CreateIndex
CREATE INDEX "RecurringCashflow_category_id_idx" ON "RecurringCashflow"("category_id");

-- AddForeignKey
ALTER TABLE "FundAccount" ADD CONSTRAINT "FundAccount_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashflowCategory" ADD CONSTRAINT "CashflowCategory_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashflowRecord" ADD CONSTRAINT "CashflowRecord_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashflowRecord" ADD CONSTRAINT "CashflowRecord_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "CashflowCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashflowRecord" ADD CONSTRAINT "CashflowRecord_fund_account_id_fkey" FOREIGN KEY ("fund_account_id") REFERENCES "FundAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashflowRecord" ADD CONSTRAINT "CashflowRecord_recurring_cashflow_id_fkey" FOREIGN KEY ("recurring_cashflow_id") REFERENCES "RecurringCashflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringCashflow" ADD CONSTRAINT "RecurringCashflow_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringCashflow" ADD CONSTRAINT "RecurringCashflow_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "CashflowCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringCashflow" ADD CONSTRAINT "RecurringCashflow_fund_account_id_fkey" FOREIGN KEY ("fund_account_id") REFERENCES "FundAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
