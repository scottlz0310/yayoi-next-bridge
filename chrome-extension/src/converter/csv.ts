/**
 * CSV読み書きユーティリティ（行配列基準）
 *
 * コア表現: Array<Array<string>>（行×列の2次元配列）
 * これにより、改行コード（CRLF/LF）の問題を切り離し、
 * CSV引用符・カンマ含み文字列の処理を共通化する。
 */

/**
 * CSV文字列をパースして2次元配列に変換
 *
 * @param csvText - パースするCSV文字列
 * @returns 2次元配列（行×列）
 */
export function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < csvText.length) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // エスケープされた引用符
          currentField += '"';
          i += 2;
          continue;
        }
        // 引用符の終了
        inQuotes = false;
        i++;
        continue;
      }
      // 引用符内の文字
      currentField += char;
      i++;
      continue;
    }

    // 引用符外の処理
    if (char === '"') {
      // 引用符の開始
      inQuotes = true;
      i++;
      continue;
    }

    if (char === ',') {
      // フィールドの終了
      currentRow.push(currentField);
      currentField = '';
      i++;
      continue;
    }

    if (char === '\r' && nextChar === '\n') {
      // CRLF（行の終了）
      currentRow.push(currentField);
      if (currentRow.length > 0 || currentField !== '') {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      i += 2;
      continue;
    }

    if (char === '\n') {
      // LF（行の終了）
      currentRow.push(currentField);
      if (currentRow.length > 0 || currentField !== '') {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      i++;
      continue;
    }

    if (char === '\r') {
      // CR（行の終了 - 古いMac形式）
      currentRow.push(currentField);
      if (currentRow.length > 0 || currentField !== '') {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      i++;
      continue;
    }

    // 通常の文字
    currentField += char;
    i++;
  }

  // 最後のフィールドと行を追加
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // 空行をフィルタリング
  return rows.filter((row) => row.length > 0 && !row.every((field) => field.trim() === ''));
}

/**
 * 2次元配列をCSV文字列に変換（QUOTE_MINIMAL相当）
 *
 * @param rows - 2次元配列（行×列）
 * @returns CSV文字列（CRLF改行）
 */
export function stringifyCSV(rows: string[][]): string {
  const lines = rows.map((row) => {
    return row
      .map((field) => {
        // カンマ、改行、引用符を含む場合は引用符で囲む
        if (
          field.includes(',') ||
          field.includes('\n') ||
          field.includes('\r') ||
          field.includes('"')
        ) {
          // 引用符をエスケープ（"" に変換）
          const escaped = field.replace(/"/g, '""');
          return `"${escaped}"`;
        }
        return field;
      })
      .join(',');
  });

  // 弥生会計NEXTの形式に合わせ、最終行もCRLFで終わる
  return `${lines.join('\r\n')}\r\n`;
}
