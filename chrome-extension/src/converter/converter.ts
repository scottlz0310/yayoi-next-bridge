/**
 * 弥生給与NEXT → 弥生会計NEXT 変換コアロジック
 *
 * referenceとyayoi_next_bridge/coreのプロトタイプをベースに
 * TypeScriptで型安全に実装したモジュール。
 */
import { parseCSV, stringifyCSV } from './csv.ts';
import type {
  AccountingEntry,
  ConversionOptions,
  ConversionResult,
  PayrollEntry,
} from './types.ts';

// 定数定義
const PAYROLL_FIELD_COUNT = 14;
const DATE_STRING_LENGTH = 8;

// 有効なフラグ値
const VALID_FLAGS = ['0110', '0100', '0101'] as const;
const FLAG_START = '0110';
const FLAG_END = '0101';

/**
 * 日付文字列がYYYYMMDD形式として妥当かチェック
 * @param dateStr - チェックする日付文字列
 * @returns 妥当な場合true
 */
function isValidDateFormat(dateStr: string): boolean {
  if (dateStr.length !== DATE_STRING_LENGTH) {
    return false;
  }
  // 全て数字かチェック
  if (!/^\d{8}$/.test(dateStr)) {
    return false;
  }
  // 基本的な日付妥当性チェック
  const year = Number.parseInt(dateStr.slice(0, 4), 10);
  const month = Number.parseInt(dateStr.slice(4, 6), 10);
  const day = Number.parseInt(dateStr.slice(6, 8), 10);

  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  return true;
}

/**
 * CSVフィールドからPayrollEntryを生成
 *
 * @param fields - CSVフィールド配列
 * @returns PayrollEntry
 * @throws Error 不正なデータの場合
 */
function parsePayrollEntry(fields: string[]): PayrollEntry {
  // フィールド数チェック
  if (fields.length < PAYROLL_FIELD_COUNT) {
    throw new Error(
      `入力データの項目数が不足しています。期待: ${PAYROLL_FIELD_COUNT}項目、実際: ${fields.length}項目`
    );
  }

  const flag = fields[0] ?? '';
  const dateRaw = fields[2] ?? '';

  // フラグの妥当性チェック
  if (!VALID_FLAGS.includes(flag as (typeof VALID_FLAGS)[number])) {
    throw new Error(`不正な識別フラグです: "${flag}" (有効値: ${VALID_FLAGS.join(', ')})`);
  }

  // 日付の妥当性チェック
  if (!isValidDateFormat(dateRaw)) {
    throw new Error(`不正な日付形式です: "${dateRaw}" (期待形式: YYYYMMDD)`);
  }

  return {
    flag,
    unknown: fields[1] ?? '',
    dateRaw,
    debitAccount: fields[3] ?? '',
    debitSub: fields[4] ?? '',
    debitAmount: fields[7] ?? '',
    creditAccount: fields[8] ?? '',
    creditSub: fields[9] ?? '',
    creditAmount: fields[12] ?? '',
    description: fields[13] ?? '',
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
 * @returns 変換結果
 */
export function convertPayrollToAccounting(inputRows: string[][]): {
  outputRows: string[][];
  result: ConversionResult;
} {
  const outputRows: string[][] = [];
  let slipCount = 0;
  let currentSlipRows: string[][] = [];
  let isFirstNonEmptyLine = true;

  try {
    // 入力が空の場合
    if (inputRows.length === 0) {
      throw new Error('入力データが空です');
    }

    for (let i = 0; i < inputRows.length; i++) {
      const fields = inputRows[i];
      if (!fields) continue;

      // 空行をスキップ
      if (fields.length === 0 || fields.every((f) => f.trim() === '')) {
        continue;
      }

      const payrollEntry = parsePayrollEntry(fields);

      // 最初の非空行は0110でなければならない
      if (isFirstNonEmptyLine) {
        if (payrollEntry.flag !== FLAG_START) {
          throw new Error(
            `最初の行は識別フラグ "${FLAG_START}" でなければなりません（実際: "${payrollEntry.flag}"、行: ${i + 1}）`
          );
        }
        isFirstNonEmptyLine = false;
      }

      // 伝票の開始を判定
      if (payrollEntry.flag === FLAG_START) {
        // 前の伝票があれば妥当性をチェックして出力リストに追加
        if (currentSlipRows.length > 0) {
          // 前の伝票が0101で終わっているかチェック
          const lastEntry = inputRows[i - 1];
          if (lastEntry && lastEntry.length > 0 && lastEntry[0] !== FLAG_END) {
            throw new Error(`伝票が識別フラグ "${FLAG_END}" で終了していません（行: ${i}）`);
          }
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
      // 最後の伝票が0101で終わっているかチェック
      const lastRow = inputRows[inputRows.length - 1];
      if (lastRow && lastRow.length > 0 && lastRow[0] !== FLAG_END) {
        throw new Error(`最後の伝票が識別フラグ "${FLAG_END}" で終了していません`);
      }
      outputRows.push(...currentSlipRows);
      slipCount++;
    }

    // 結果が空の場合はエラー
    if (outputRows.length === 0) {
      throw new Error('変換結果が空です。有効なデータが含まれていません');
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
 * @param _options - 変換オプション（将来の拡張用）
 * @returns 出力CSVテキスト（弥生会計NEXT形式）と変換結果
 */
export function convertCSVText(
  inputText: string,
  _options?: ConversionOptions
): { outputText: string; result: ConversionResult } {
  const inputRows = parseCSV(inputText);
  const { outputRows, result } = convertPayrollToAccounting(inputRows);

  if (!result.success) {
    return { outputText: '', result };
  }

  const outputText = stringifyCSV(outputRows);
  return { outputText, result };
}
