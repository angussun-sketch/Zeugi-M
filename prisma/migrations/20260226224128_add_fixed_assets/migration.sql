-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "acquisition_date" TIMESTAMP(3) NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "residual_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "useful_life_months" INTEGER NOT NULL,
    "depreciation_method" TEXT NOT NULL DEFAULT 'straight_line',
    "monthly_depreciation" DOUBLE PRECISION NOT NULL,
    "accumulated_depreciation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_book_value" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_fully_depreciated" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "payment_method" TEXT NOT NULL DEFAULT 'cash',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepreciationRecord" (
    "id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepreciationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixedAsset_is_active_idx" ON "FixedAsset"("is_active");

-- CreateIndex
CREATE INDEX "DepreciationRecord_asset_id_idx" ON "DepreciationRecord"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "DepreciationRecord_asset_id_period_year_period_month_key" ON "DepreciationRecord"("asset_id", "period_year", "period_month");

-- AddForeignKey
ALTER TABLE "DepreciationRecord" ADD CONSTRAINT "DepreciationRecord_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
