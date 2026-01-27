/**
 * 弥生給与NEXT → 弥生会計NEXT 変換コアロジック
 *
 * referenceとyayoi_next_bridge/coreのプロトタイプをベースに
 * TypeScriptで型安全に実装したモジュール。
 */
import { parseCSV, stringifyCSV } from './csv.ts';
import type { AccountingEntry, ConversionOptions, ConversionResult, PayrollEntry } from './types.ts';

// 定数定義
const PAYROLL_FIELD_COUNT = 14;
const DATE_STRING_LENGTH = 8;

/**
 * CSVフィールドからPayrollEntryを生成
 *
 * @param fields - CSVフィールド配列
 * @returns PayrollEntry
 */
function parsePayrollEntry(fields: string[]): PayrollEntry {
  // 不足項目を空白で埋める
  const paddedFields = [...fields];
  while (paddedFields.length < PAYROLL_FIELD_COUNT) {
    paddedFields.push('');
  }

  return {
    flag: paddedFields[0] ?? '',
    unknown: paddedFields[1] ?? '',
    dateRaw: paddedFields[2] ?? '',
    debitAccount: paddedFields[3] ?? '',
    debitSub: paddedFields[4] ?? '',
    debitAmount: paddedFields[7] ?? '',
    creditAccount: paddedFields[8] ?? '',
    creditSub: paddedFields[9] ?? '',
    creditAmount: paddedFields[12] ?? '',
    description: paddedFields[13] ?? '',
  };
}

/**
 * 日付をYYYYMMDD形式からYYYY/MM/DD形式に変換
 *
 * @param dateStr - YYYYMMDD形式の日付文字列
 * @returns YYYY/MM/DD形式の日付文字列
 */
function formatDate(dateStr: string): string {
  if (dateStr.length === DATE_STRING_LENGTH) {
    return `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

/**
 * 識別フラグを変換
 *
 * 弥生給与NEXT: 0110(開始), 0100(中間), 0101(終了)
 * 弥生会計NEXT: 2110(複数行1行目), 2100(中間行), 2101(最終行)
 * 出典: https://support.yayoi-kk.co.jp/subcontents.html?page_id=29611
 *
 * @param originalFlag - 元のフラグ
 * @param isFirstLine - 伝票の最初の行かどうか
 * @returns 変換後のフラグ
 */
function convertFlag(originalFlag: string, isFirstLine: boolean): string {
  if (isFirstLine) {
    return '2110'; // 複数行の仕訳データ 1行目
  }
  if (originalFlag === '0101') {
    return '2101'; // 複数行の仕訳データ 最終行
  }
  return '2100'; // 複数行の仕訳データ 中間行
}

/**
 * PayrollEntryをAccountingEntryに変換
 *
 * 税区分について（公式仕様より）:
 * - 借方/貸方税区分は「必須」項目
 * - 複数行の仕訳データで勘定科目がない場合のみ空白可
 * - 給与関連仕訳は消費税対象外のため「対象外」を設定
 *
 * 金額について（公式仕様より）:
 * - 借方/貸方税込金額は「必須」項目
 * - 複数行の仕訳データで勘定科目がない場合でも必須
 * - 勘定科目がない場合は「0」を入力
 *
 * @param entry - 変換元のPayrollEntry
 * @param isFirstLine - 伝票の最初の行かどうか
 * @returns 変換後のAccountingEntry
 */
function convertEntry(entry: PayrollEntry, isFirstLine: boolean): AccountingEntry {
  // 勘定科目がある場合は税区分「対象外」、ない場合は空白
  const debitTaxClass = entry.debitAccount ? '対象外' : '';
  const creditTaxClass = entry.creditAccount ? '対象外' : '';

  // 金額: 勘定科目がある場合は元の金額、ない場合は「0」（必須項目）
  const debitAmount = entry.debitAccount ? entry.debitAmount : '0';
  const creditAmount = entry.creditAccount ? entry.creditAmount : '0';

  return {
    flag: convertFlag(entry.flag, isFirstLine),
    slipNo: '', // 空白で自動採番
    settlement: '', // 通常仕訳は空白
    date: formatDate(entry.dateRaw),
    debitAccount: entry.debitAccount,
    debitSub: entry.debitSub,
    debitDept: '',
    debitTaxClass,
    debitAmount,
    debitTaxAmount: '',
    creditAccount: entry.creditAccount,
    creditSub: entry.creditSub,
    creditDept: '',
    creditTaxClass,
    creditAmount,
    creditTaxAmount: '',
    description: entry.description,
    number: '',
    dueDate: '',
    entryType: '0', // 0=通常
    source: '',
    memo: '',
    tag1: '',
    tag2: '',
    adjustment: '',
  };
}

/**
 * AccountingEntryをCSVフィールド配列に変換
 *
 * @param entry - AccountingEntry
 * @returns CSVフィールド配列（25項目）
 */
function accountingEntryToFields(entry: AccountingEntry): string[] {
  return [
    entry.flag,
    entry.slipNo,
    entry.settlement,
    entry.date,
    entry.debitAccount,
    entry.debitSub,
    entry.debitDept,
    entry.debitTaxClass,
    entry.debitAmount,
    entry.debitTaxAmount,
    entry.creditAccount,
    entry.creditSub,
    entry.creditDept,
    entry.creditTaxClass,
    entry.creditAmount,
    entry.creditTaxAmount,
    entry.description,
    entry.number,
    entry.dueDate,
    entry.entryType,
    entry.source,
    entry.memo,
    entry.tag1,
    entry.tag2,
    entry.adjustment,
  ];
}

/**
 * 弥生給与NEXTのCSV行配列を弥生会計NEXT形式に変換
 *
 * @param inputRows - 入力CSV行配列（弥生給与NEXT形式）
 * @param options - 変換オプション
 * @returns 変換結果
 */
export function convertPayrollToAccounting(
  inputRows: string[][],
  options?: ConversionOptions
): { outputRows: string[][]; result: ConversionResult } {
  const outputRows: string[][] = [];
  let slipCount = 0;
  let currentSlipRows: string[][] = [];

  try {
    for (const fields of inputRows) {
      // 空行をスキップ
      if (fields.length === 0 || fields.every((f) => f.trim() === '')) {
        continue;
      }

      const payrollEntry = parsePayrollEntry(fields);

      // 伝票の開始を判定
      if (payrollEntry.flag === '0110') {
        // 前の伝票があれば出力リストに追加
        if (currentSlipRows.length > 0) {
          outputRows.push(...currentSlipRows);
          slipCount++;
        }
        currentSlipRows = [];
      }

      // 変換
      const isFirstLine = currentSlipRows.length === 0;
      const accountingEntry = convertEntry(payrollEntry, isFirstLine);
      const outputFields = accountingEntryToFields(accountingEntry);
      currentSlipRows.push(outputFields);
    }

    // 最後の伝票を追加
    if (currentSlipRows.length > 0) {
      outputRows.push(...currentSlipRows);
      slipCount++;
    }

    return {
      outputRows,
      result: {
        success: true,
        slipCount,
        rowCount: outputRows.length,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
    return {
      outputRows: [],
      result: {
        success: false,
        slipCount: 0,
        rowCount: 0,
        errorMessage,
      },
    };
  }
}

/**
 * 弥生給与NEXTのCSVテキストを弥生会計NEXT形式に変換
 *
 * @param inputText - 入力CSVテキスト（弥生給与NEXT形式）
 * @param options - 変換オプション
 * @returns 出力CSVテキスト（弥生会計NEXT形式）と変換結果
 */
export function convertCSVText(
  inputText: string,
  options?: ConversionOptions
): { outputText: string; result: ConversionResult } {
  const inputRows = parseCSV(inputText);
  const { outputRows, result } = convertPayrollToAccounting(inputRows, options);

  if (!result.success) {
    return { outputText: '', result };
  }

  const outputText = stringifyCSV(outputRows);
  return { outputText, result };
}
