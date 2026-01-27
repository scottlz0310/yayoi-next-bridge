/**
 * 弥生給与NEXTの仕訳行（14項目）を表すインターフェース
 *
 * 入力形式:
 * [0] 識別フラグ (0110=伝票開始, 0100=中間行, 0101=伝票終了)
 * [1] 不明（通常空白）
 * [2] 日付 (YYYYMMDD)
 * [3] 借方勘定科目
 * [4] 借方補助科目
 * [5] 空白
 * [6] 空白
 * [7] 借方金額
 * [8] 貸方勘定科目
 * [9] 貸方補助科目
 * [10] 空白
 * [11] 空白
 * [12] 貸方金額
 * [13] 摘要
 */
export interface PayrollEntry {
  /** 識別フラグ (0110=開始, 0100=中間, 0101=終了) */
  flag: string;
  /** 不明項目（通常空白） */
  unknown: string;
  /** 日付 (YYYYMMDD形式) */
  dateRaw: string;
  /** 借方勘定科目 */
  debitAccount: string;
  /** 借方補助科目 */
  debitSub: string;
  /** 借方金額 */
  debitAmount: string;
  /** 貸方勘定科目 */
  creditAccount: string;
  /** 貸方補助科目 */
  creditSub: string;
  /** 貸方金額 */
  creditAmount: string;
  /** 摘要 */
  description: string;
}

/**
 * 弥生会計NEXTの仕訳行（25項目）を表すインターフェース
 *
 * 出典: https://support.yayoi-kk.co.jp/subcontents.html?page_id=29611
 *
 * 1: 識別フラグ (2110=複数行1行目, 2100=中間行, 2101=最終行)
 * 2: 伝票No
 * 3: 決算 (空白=通常、1=決算、2=調整)
 * 4: 取引日付 (YYYY/MM/DD形式)
 * 5-10: 借方（勘定科目、補助科目、部門、税区分、金額、税金額）
 * 11-16: 貸方（同上）
 * 17: 摘要
 * 18-25: 番号、期日、タイプ、生成元、仕訳メモ、付箋1、付箋2、調整
 */
export interface AccountingEntry {
  /** 識別フラグ (2110/2100/2101) */
  flag: string;
  /** 伝票No（空白で自動採番） */
  slipNo: string;
  /** 決算 */
  settlement: string;
  /** 取引日付 (YYYY/MM/DD形式) */
  date: string;
  /** 借方勘定科目 */
  debitAccount: string;
  /** 借方補助科目 */
  debitSub: string;
  /** 借方部門 */
  debitDept: string;
  /** 借方税区分 */
  debitTaxClass: string;
  /** 借方金額 */
  debitAmount: string;
  /** 借方税金額 */
  debitTaxAmount: string;
  /** 貸方勘定科目 */
  creditAccount: string;
  /** 貸方補助科目 */
  creditSub: string;
  /** 貸方部門 */
  creditDept: string;
  /** 貸方税区分 */
  creditTaxClass: string;
  /** 貸方金額 */
  creditAmount: string;
  /** 貸方税金額 */
  creditTaxAmount: string;
  /** 摘要 */
  description: string;
  /** 番号 */
  number: string;
  /** 期日 */
  dueDate: string;
  /** タイプ */
  entryType: string;
  /** 生成元 */
  source: string;
  /** 仕訳メモ */
  memo: string;
  /** 付箋1 */
  tag1: string;
  /** 付箋2 */
  tag2: string;
  /** 調整 */
  adjustment: string;
}

/**
 * 変換結果を表すインターフェース
 */
export interface ConversionResult {
  /** 成功したか */
  success: boolean;
  /** 変換した伝票数 */
  slipCount: number;
  /** 変換した行数 */
  rowCount: number;
  /** エラーメッセージ（失敗時のみ） */
  errorMessage?: string;
}

/**
 * 変換オプション
 */
export interface ConversionOptions {
  /** 入力ファイル名（サマリ表示用） */
  inputFileName?: string;
}
