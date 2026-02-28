# Zeugi-M 領域術語表

## 多主體

| 術語 | 英文 | 說明 |
| --- | --- | --- |
| 組織 | Organization (org) | 最上層群組，通常代表一個老闆的所有事業 |
| 主體/公司 | Entity | 獨立法律實體，有統編（tax_id），如「美味烘焙行」 |
| 統編 | tax_id | 台灣營利事業統一編號，8 碼 |
| Org-level 資源 | — | 跨公司共用：Ingredient, Supplier, Account, FundAccount, CashflowCategory |
| Entity-level 資源 | — | 按公司隔離：PurchaseOrder, Transaction, Batch, CashflowRecord, FixedAsset |

## 原料與叫貨

| 術語 | 英文 | 說明 |
| --- | --- | --- |
| 原料 | Ingredient | 生產用物料（麵粉、奶油等） |
| 叫貨單 | PurchaseOrder (PO) | 向供應商採購的單據 |
| 供應商 | Supplier | 原料供貨商 |
| 基礎單位 | base unit | 系統內部統一單位：重量=g，體積=cc |
| 台斤 | — | 台灣傳統重量單位，1 台斤 = 600g |
| 包裝單位 | package unit | 箱/袋/瓶/桶/罐，需指定每單位含量後換算 |

## 配方與成本

| 術語 | 英文 | 說明 |
| --- | --- | --- |
| 配方/菜單 | Batch | 一次生產的配方（如「芋頭酥 100 顆」） |
| 投入 | BatchInput | 配方使用的原料及用量 |
| 產出/口味 | BatchOutput | 配方產出的各口味及數量 |
| 快照成本 | snapshot cost | 建立配方時鎖定的原料單價，存入 DB |
| 即時成本 | live cost | 以最新叫貨單價格重算的成本，不存 DB |
| 分攤 | allocation | 共用原料按比例分配到各口味（by_pieces / by_filling_weight） |

## 財務

| 術語 | 英文 | 說明 |
| --- | --- | --- |
| 交易 | Transaction | 每筆業務事件的財務紀錄主檔 |
| 分錄 | JournalEntry + JournalLine | 複式簿記的借貸紀錄 |
| 內帳 | internal book | 管理用帳本（含所有交易） |
| 外帳 | tax book | 報稅用帳本（可能排除部分交易） |
| 調節項 | ReconciliationItem | 內帳與外帳差異的說明紀錄 |
| 科目 | Account | 會計科目（如 1101 現金、5131 進貨成本） |
| 三方匹配 | three-way match | 付款(payment) + 收據(receipt) + 發票(invoice) 齊全 |
| 過帳 | post | 將 draft 狀態的 Transaction 確認為 posted |
| 作廢 | void | 將 Transaction 標記為 voided，刪除所有分錄 |

## 現金流

| 術語 | 英文 | 說明 |
| --- | --- | --- |
| 收支紀錄 | CashflowRecord | 實際的收入或支出紀錄 |
| 收支分類 | CashflowCategory | 如「成本·進貨 · 原料費」、「營業收入 · 門市營收」 |
| 資金帳戶 | FundAccount | 現金/銀行/信用卡帳戶 |
| 循環收支 | RecurringCashflow | 每月固定日期自動產生的收支（如房租） |
| 排程產生 | generate | Cron 觸發，自動建立 CashflowRecord + Transaction |

## 固定資產

| 術語 | 英文 | 說明 |
| --- | --- | --- |
| 固定資產 | FixedAsset | 設備/車輛/建物等長期資產 |
| 折舊 | Depreciation | 資產價值隨時間遞減的會計處理 |
| 直線法 | straight_line | 每月固定折舊額 = (成本 - 殘值) / 耐用月數 |
| 殘值 | residual_value | 資產耐用年限結束後的預估價值 |
| 帳面淨值 | net_book_value | 成本 - 累計折舊 |
