-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "measure_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRecord" (
    "id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "purchase_price" DOUBLE PRECISION NOT NULL,
    "purchase_qty_base" DOUBLE PRECISION NOT NULL,
    "purchase_unit" TEXT NOT NULL,
    "package_count" INTEGER,
    "per_package_qty" DOUBLE PRECISION,
    "per_package_unit" TEXT,
    "unit_cost_base" DOUBLE PRECISION NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alloc_method" TEXT NOT NULL,
    "total_cost" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchInput" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "qty_input" DOUBLE PRECISION NOT NULL,
    "input_unit" TEXT NOT NULL,
    "qty_base" DOUBLE PRECISION NOT NULL,
    "unit_cost_used" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "is_shared" BOOLEAN NOT NULL DEFAULT true,
    "dedicated_to" TEXT,

    CONSTRAINT "BatchInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchOutput" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "flavor_name" TEXT NOT NULL,
    "pieces" INTEGER NOT NULL,
    "filling_g_per_piece" DOUBLE PRECISION,
    "total_cost" DOUBLE PRECISION,
    "cost_per_piece" DOUBLE PRECISION,

    CONSTRAINT "BatchOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseRecord" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "salary_type" TEXT NOT NULL,
    "salary_amount" DOUBLE PRECISION NOT NULL,
    "hire_date" TIMESTAMP(3) NOT NULL,
    "leave_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION,
    "status" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryRecord" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "base_amount" DOUBLE PRECISION NOT NULL,
    "overtime_pay" DOUBLE PRECISION,
    "deductions" DOUBLE PRECISION,
    "bonus" DOUBLE PRECISION,
    "labor_insurance" DOUBLE PRECISION,
    "health_insurance" DOUBLE PRECISION,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- CreateIndex
CREATE INDEX "PurchaseRecord_ingredient_id_is_current_idx" ON "PurchaseRecord"("ingredient_id", "is_current");

-- CreateIndex
CREATE INDEX "BatchInput_batch_id_idx" ON "BatchInput"("batch_id");

-- CreateIndex
CREATE INDEX "BatchOutput_batch_id_idx" ON "BatchOutput"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE INDEX "ExpenseRecord_category_id_idx" ON "ExpenseRecord"("category_id");

-- CreateIndex
CREATE INDEX "Attendance_employee_id_date_idx" ON "Attendance"("employee_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryRecord_employee_id_period_year_period_month_key" ON "SalaryRecord"("employee_id", "period_year", "period_month");

-- AddForeignKey
ALTER TABLE "PurchaseRecord" ADD CONSTRAINT "PurchaseRecord_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchInput" ADD CONSTRAINT "BatchInput_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchInput" ADD CONSTRAINT "BatchInput_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchOutput" ADD CONSTRAINT "BatchOutput_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ExpenseCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRecord" ADD CONSTRAINT "SalaryRecord_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
