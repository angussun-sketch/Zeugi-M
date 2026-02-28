/**
 * 科目代碼常數 — 對齊台灣商業會計項目表（112年度）
 *
 * 依商業會計法第27條，商業得視實際需要增減會計項目。
 * 本檔為系統 single source of truth，journal-engine 及 fixed-assets 皆從此引用。
 */

// ============ 1. 資產 (Assets) ============

// 111 現金及約當現金
export const CASH_ON_HAND = "1111"; // 庫存現金
export const PETTY_CASH = "1112"; // 零用金／週轉金
export const CASH_IN_BANKS = "1113"; // 銀行存款

// 119 應收帳款
export const ACCOUNTS_RECEIVABLE = "1191"; // 應收帳款

// 123-124 存貨
export const INVENTORY_FINISHED = "1235"; // 製成品
export const INVENTORY_WIP = "1237"; // 在製品
export const INVENTORY_RAW = "1239"; // 原料

// 126-127 預付款項
export const INPUT_VAT = "1268"; // 進項稅額

// 139-146 不動產、廠房及設備
export const MACHINERY_COST = "1421"; // 機器設備—成本
export const MACHINERY_ACCUM_DEPR = "1422"; // 累計折舊—機器設備
export const MACHINERY_ACCUM_IMPAIR = "1423"; // 累計減損—機器設備
export const OFFICE_EQUIP_COST = "1431"; // 辦公設備—成本
export const OFFICE_EQUIP_ACCUM_DEPR = "1432"; // 累計折舊—辦公設備
export const LEASEHOLD_IMPROVE_COST = "1461"; // 租賃權益改良—成本
export const LEASEHOLD_IMPROVE_ACCUM_DEPR = "1462"; // 累計折舊—租賃權益改良

// 157-158 其他非流動資產
export const OWNER_ACCOUNT_DEBIT = "1584"; // 業主(股東)往來（借方）

// ============ 2. 負債 (Liabilities) ============

// 217 應付帳款
export const ACCOUNTS_PAYABLE = "2171"; // 應付帳款

// 219-220 其他應付款
export const SALARIES_PAYABLE = "2191"; // 應付薪資
export const BUSINESS_TAX_PAYABLE = "2194"; // 應付營業稅
export const OTHER_PAYABLES = "2206"; // 其他應付款—其他（含信用卡）
export const OUTPUT_VAT = "2204"; // 銷項稅額

// 239 其他非流動負債
export const OWNER_ACCOUNT_CREDIT = "2393"; // 業主(股東)往來（貸方）

// ============ 3. 權益 (Equity) ============

export const OWNER_CAPITAL = "3111"; // 普通股股本 / 業主資本

// ============ 4. 營業收入 (Operating Revenue) ============

export const SALES_REVENUE = "4111"; // 銷貨收入
export const SERVICE_REVENUE = "4121"; // 勞務收入
export const OTHER_OPERATING_REVENUE = "4141"; // 其他營業收入

// ============ 5. 營業成本 (Operating Costs) ============

// 511 銷貨成本
export const COST_OF_SALES = "5111"; // 銷貨成本

// 513 進料
export const PURCHASE_RAW_MATERIALS = "5131"; // 進料

// 514 直接人工
export const DIRECT_LABOR = "5141"; // 直接人工

// 515-516 製造費用
export const OVERHEAD_INDIRECT_LABOR = "5151"; // 間接人工
export const OVERHEAD_RENT = "5152"; // 租金支出（製造）
export const OVERHEAD_FREIGHT = "5155"; // 運費（製造）
export const OVERHEAD_REPAIRS = "5157"; // 修繕費（製造）
export const OVERHEAD_PACKING = "5158"; // 包裝費
export const OVERHEAD_UTILITIES = "5159"; // 水電瓦斯費（製造）
export const OVERHEAD_INSURANCE = "5160"; // 保險費（製造）
export const OVERHEAD_TAXES = "5162"; // 稅捐（製造）
export const OVERHEAD_DEPRECIATION = "5163"; // 折舊（製造）
export const OVERHEAD_OTHER = "5169"; // 其他製造費用

// ============ 6. 營業費用 (Operating Expenses) ============

export const OPEX_SALARIES = "6111"; // 薪資支出
export const OPEX_RENT = "6112"; // 租金支出
export const OPEX_FREIGHT = "6115"; // 運費
export const OPEX_REPAIRS = "6117"; // 修繕費
export const OPEX_UTILITIES = "6119"; // 水電瓦斯費
export const OPEX_INSURANCE = "6120"; // 保險費
export const OPEX_TAXES = "6123"; // 稅捐
export const OPEX_DEPRECIATION = "6125"; // 折舊
export const OPEX_OTHER = "6134"; // 其他營業費用

// ============ 7. 營業外收益及費損 ============

export const INTEREST_REVENUE = "7111"; // 利息收入
export const INTEREST_EXPENSE = "7151"; // 利息費用

// ============ 複合映射表 ============

/** 付款方式 → 科目代碼 */
export const PAYMENT_ACCOUNT: Record<string, string> = {
  cash: CASH_ON_HAND,
  bank: CASH_IN_BANKS,
  credit_card: OTHER_PAYABLES,
  owner_advance: OWNER_ACCOUNT_CREDIT,
};

/** 費用分類名稱 → 科目代碼（營業費用為主，生產相關另行處理） */
export const EXPENSE_ACCOUNT: Record<string, string> = {
  進貨成本: PURCHASE_RAW_MATERIALS,
  原料: PURCHASE_RAW_MATERIALS,
  進料: PURCHASE_RAW_MATERIALS,
  直接人工: DIRECT_LABOR,
  包材: OVERHEAD_PACKING,
  包材費: OVERHEAD_PACKING,
  包裝: OVERHEAD_PACKING,
  包裝費: OVERHEAD_PACKING,
  薪資: OPEX_SALARIES,
  薪資費用: OPEX_SALARIES,
  租金: OPEX_RENT,
  租金費用: OPEX_RENT,
  水電: OPEX_UTILITIES,
  水電費: OPEX_UTILITIES,
  油料: OPEX_OTHER,
  油料費: OPEX_OTHER,
  修繕: OPEX_REPAIRS,
  修繕費: OPEX_REPAIRS,
  運費: OPEX_FREIGHT,
  保險: OPEX_INSURANCE,
  保險費: OPEX_INSURANCE,
  稅捐: OPEX_TAXES,
  折舊: OPEX_DEPRECIATION,
  折舊費用: OPEX_DEPRECIATION,
};

/** 預設費用科目（無法匹配時使用） */
export const DEFAULT_EXPENSE_CODE = OPEX_OTHER;

/** 固定資產類別 → 成本科目 */
export const ASSET_ACCOUNT: Record<string, string> = {
  equipment: MACHINERY_COST,
  vehicle: OFFICE_EQUIP_COST, // 運輸設備無官方代碼，暫歸辦公設備
  building: LEASEHOLD_IMPROVE_COST,
  other: MACHINERY_COST,
};

/** 固定資產類別 → 累計折舊科目 */
export const ACCUM_DEPR_ACCOUNT: Record<string, string> = {
  equipment: MACHINERY_ACCUM_DEPR,
  vehicle: OFFICE_EQUIP_ACCUM_DEPR,
  building: LEASEHOLD_IMPROVE_ACCUM_DEPR,
  other: MACHINERY_ACCUM_DEPR,
};

// ---- 收入科目映射 ----
export const INCOME_ACCOUNT: Record<string, string> = {
  門市營收: SALES_REVENUE,
  批發收入: SALES_REVENUE,
  外送平台收入: SALES_REVENUE,
  勞務收入: SERVICE_REVENUE,
  利息收入: INTEREST_REVENUE,
  補助收入: OTHER_OPERATING_REVENUE,
  其他收入: OTHER_OPERATING_REVENUE,
};

export const DEFAULT_INCOME_CODE = SALES_REVENUE; // "4111"
