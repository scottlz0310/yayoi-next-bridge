// ==UserScript==
// @name         弥生NEXTブリッジ
// @namespace    https://github.com/your-repo/yayoi-next-bridge
// @version      0.1.0
// @description  弥生給与NEXTのデータを弥生会計NEXTのインポート形式に変換します
// @author       Your Name
// @match        https://next-kaikei.yayoi-kk.co.jp/*
// @icon         https://www.yayoi-kk.co.jp/favicon.ico
// @grant        none
// @run-at       document-idle
// @license      MIT
// @require      https://cdn.jsdelivr.net/npm/encoding-japanese@2.2.0/encoding.min.js
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  // 定数
  // ============================================================
  const IMPORT_PAGE_PATH = '/config/data-management/import';
  const PAYROLL_FIELD_COUNT = 14;
  const DATE_STRING_LENGTH = 8;
  const VALID_FLAGS = ['0110', '0100', '0101'];
  const FLAG_START = '0110';
  const FLAG_END = '0101';

  // ============================================================
  // CSV パーサー / シリアライザー
  // ============================================================

  /**
   * CSV文字列をパースして2次元配列に変換
   * @param {string} csvText
   * @returns {string[][]}
   */
  function parseCSV(csvText) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < csvText.length) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentField += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        currentField += char;
        i++;
        continue;
      }

      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }

      if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      }

      if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentField);
        if (currentRow.length > 0 || currentField !== '') {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i += 2;
        continue;
      }

      if (char === '\n' || char === '\r') {
        currentRow.push(currentField);
        if (currentRow.length > 0 || currentField !== '') {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
        continue;
      }

      currentField += char;
      i++;
    }

    if (currentField !== '' || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }

    return rows.filter(
      (row) => row.length > 0 && !row.every((field) => field.trim() === '')
    );
  }

  /**
   * 2次元配列をCSV文字列に変換
   * @param {string[][]} rows
   * @returns {string}
   */
  function stringifyCSV(rows) {
    const lines = rows.map((row) => {
      return row
        .map((field) => {
          if (
            field.includes(',') ||
            field.includes('\n') ||
            field.includes('\r') ||
            field.includes('"')
          ) {
            const escaped = field.replace(/"/g, '""');
            return `"${escaped}"`;
          }
          return field;
        })
        .join(',');
    });
    return lines.join('\r\n') + '\r\n';
  }

  // ============================================================
  // Shift-JIS エンコーディング (encoding-japanese使用)
  // ============================================================

  /* global Encoding */

  /**
   * ArrayBufferをShift-JISとしてデコード
   * @param {ArrayBuffer} buffer
   * @returns {string}
   */
  function decodeShiftJIS(buffer) {
    const uint8Array = new Uint8Array(buffer);
    const unicodeArray = Encoding.convert(uint8Array, {
      to: 'UNICODE',
      from: 'SJIS',
    });
    return Encoding.codeToString(unicodeArray);
  }

  /**
   * 文字列をShift-JISにエンコード
   * @param {string} text
   * @returns {Uint8Array}
   */
  function encodeShiftJIS(text) {
    const unicodeArray = Encoding.stringToCode(text);
    const sjisArray = Encoding.convert(unicodeArray, {
      to: 'SJIS',
      from: 'UNICODE',
    });
    return new Uint8Array(sjisArray);
  }

  // ============================================================
  // 変換コアロジック
  // ============================================================

  /**
   * 日付文字列がYYYYMMDD形式として妥当かチェック
   * @param {string} dateStr
   * @returns {boolean}
   */
  function isValidDateFormat(dateStr) {
    if (dateStr.length !== DATE_STRING_LENGTH) return false;
    if (!/^\d{8}$/.test(dateStr)) return false;

    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10);
    const day = parseInt(dateStr.slice(6, 8), 10);

    if (year < 1900 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    return true;
  }

  /**
   * CSVフィールドからPayrollEntryを生成
   * @param {string[]} fields
   * @returns {object}
   */
  function parsePayrollEntry(fields) {
    if (fields.length < PAYROLL_FIELD_COUNT) {
      throw new Error(
        `入力データの項目数が不足しています。期待: ${PAYROLL_FIELD_COUNT}項目、実際: ${fields.length}項目`
      );
    }

    const flag = fields[0] || '';
    const dateRaw = fields[2] || '';

    if (!VALID_FLAGS.includes(flag)) {
      throw new Error(
        `不正な識別フラグです: "${flag}" (有効値: ${VALID_FLAGS.join(', ')})`
      );
    }

    if (!isValidDateFormat(dateRaw)) {
      throw new Error(`不正な日付形式です: "${dateRaw}" (期待形式: YYYYMMDD)`);
    }

    return {
      flag,
      unknown: fields[1] || '',
      dateRaw,
      debitAccount: fields[3] || '',
      debitSub: fields[4] || '',
      debitAmount: fields[7] || '',
      creditAccount: fields[8] || '',
      creditSub: fields[9] || '',
      creditAmount: fields[12] || '',
      description: fields[13] || '',
    };
  }

  /**
   * 日付をYYYYMMDD形式からYYYY/MM/DD形式に変換
   * @param {string} dateStr
   * @returns {string}
   */
  function formatDate(dateStr) {
    if (dateStr.length === DATE_STRING_LENGTH) {
      return `${dateStr.slice(0, 4)}/${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`;
    }
    return dateStr;
  }

  /**
   * 識別フラグを変換
   * @param {string} originalFlag
   * @param {boolean} isFirstLine
   * @returns {string}
   */
  function convertFlag(originalFlag, isFirstLine) {
    if (isFirstLine) return '2110';
    if (originalFlag === '0101') return '2101';
    return '2100';
  }

  /**
   * PayrollEntryをAccountingEntryに変換
   * @param {object} entry
   * @param {boolean} isFirstLine
   * @returns {object}
   */
  function convertEntry(entry, isFirstLine) {
    const debitTaxClass = entry.debitAccount ? '対象外' : '';
    const creditTaxClass = entry.creditAccount ? '対象外' : '';
    const debitAmount = entry.debitAccount ? entry.debitAmount : '0';
    const creditAmount = entry.creditAccount ? entry.creditAmount : '0';

    return {
      flag: convertFlag(entry.flag, isFirstLine),
      slipNo: '',
      settlement: '',
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
      entryType: '0',
      source: '',
      memo: '',
      tag1: '',
      tag2: '',
      adjustment: '',
    };
  }

  /**
   * AccountingEntryをCSVフィールド配列に変換
   * @param {object} entry
   * @returns {string[]}
   */
  function accountingEntryToFields(entry) {
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
   * @param {string[][]} inputRows
   * @returns {{outputRows: string[][], result: object}}
   */
  function convertPayrollToAccounting(inputRows) {
    const outputRows = [];
    let slipCount = 0;
    let currentSlipRows = [];
    let isFirstNonEmptyLine = true;

    try {
      if (inputRows.length === 0) {
        throw new Error('入力データが空です');
      }

      for (let i = 0; i < inputRows.length; i++) {
        const fields = inputRows[i];
        if (!fields) continue;

        if (fields.length === 0 || fields.every((f) => f.trim() === '')) {
          continue;
        }

        const payrollEntry = parsePayrollEntry(fields);

        if (isFirstNonEmptyLine) {
          if (payrollEntry.flag !== FLAG_START) {
            throw new Error(
              `最初の行は識別フラグ "${FLAG_START}" でなければなりません（実際: "${payrollEntry.flag}"、行: ${i + 1}）`
            );
          }
          isFirstNonEmptyLine = false;
        }

        if (payrollEntry.flag === FLAG_START) {
          if (currentSlipRows.length > 0) {
            const lastEntry = inputRows[i - 1];
            if (lastEntry && lastEntry.length > 0 && lastEntry[0] !== FLAG_END) {
              throw new Error(
                `伝票が識別フラグ "${FLAG_END}" で終了していません（行: ${i}）`
              );
            }
            outputRows.push(...currentSlipRows);
            slipCount++;
          }
          currentSlipRows = [];
        }

        const isFirstLine = currentSlipRows.length === 0;
        const accountingEntry = convertEntry(payrollEntry, isFirstLine);
        const outputFields = accountingEntryToFields(accountingEntry);
        currentSlipRows.push(outputFields);
      }

      if (currentSlipRows.length > 0) {
        const lastRow = inputRows[inputRows.length - 1];
        if (lastRow && lastRow.length > 0 && lastRow[0] !== FLAG_END) {
          throw new Error(
            `最後の伝票が識別フラグ "${FLAG_END}" で終了していません`
          );
        }
        outputRows.push(...currentSlipRows);
        slipCount++;
      }

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
      return {
        outputRows: [],
        result: {
          success: false,
          slipCount: 0,
          rowCount: 0,
          errorMessage: error.message || '不明なエラーが発生しました',
        },
      };
    }
  }

  /**
   * CSVテキストを変換
   * @param {string} inputText
   * @returns {{outputText: string, result: object}}
   */
  function convertCSVText(inputText) {
    const inputRows = parseCSV(inputText);
    const { outputRows, result } = convertPayrollToAccounting(inputRows);

    if (!result.success) {
      return { outputText: '', result };
    }

    const outputText = stringifyCSV(outputRows);
    return { outputText, result };
  }

  // ============================================================
  // UI コンポーネント
  // ============================================================

  /**
   * モーダルのスタイルを定義
   */
  const MODAL_STYLES = `
    .ynb-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ynb-modal {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 420px;
      max-width: 90vw;
      max-height: 90vh;
      overflow: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .ynb-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 12px 12px 0 0;
    }

    .ynb-header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .ynb-header p {
      margin: 4px 0 0;
      font-size: 12px;
      opacity: 0.9;
    }

    .ynb-content {
      padding: 20px;
    }

    .ynb-dropzone {
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 30px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .ynb-dropzone:hover,
    .ynb-dropzone.drag-over {
      border-color: #667eea;
      background: #f8f9ff;
    }

    .ynb-dropzone-icon {
      font-size: 32px;
      margin-bottom: 8px;
    }

    .ynb-dropzone-text {
      color: #666;
      font-size: 14px;
    }

    .ynb-file-input {
      display: none;
    }

    .ynb-file-info {
      margin-top: 12px;
      padding: 10px;
      background: #f5f5f5;
      border-radius: 6px;
      font-size: 13px;
      display: none;
    }

    .ynb-file-info.visible {
      display: block;
    }

    .ynb-buttons {
      margin-top: 16px;
      display: flex;
      gap: 10px;
    }

    .ynb-btn {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .ynb-btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .ynb-btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .ynb-btn-primary:not(:disabled):hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .ynb-btn-secondary {
      background: #f0f0f0;
      color: #333;
    }

    .ynb-btn-secondary:hover {
      background: #e0e0e0;
    }

    .ynb-result {
      margin-top: 16px;
      padding: 12px;
      border-radius: 6px;
      font-size: 13px;
      display: none;
    }

    .ynb-result.visible {
      display: block;
    }

    .ynb-result.success {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .ynb-result.error {
      background: #ffebee;
      color: #c62828;
    }

    .ynb-footer {
      padding: 12px 20px;
      background: #f9f9f9;
      border-radius: 0 0 12px 12px;
      font-size: 11px;
      color: #888;
      text-align: center;
    }

    .ynb-trigger-btn {
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 10000;
      padding: 12px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      transition: all 0.2s;
    }

    .ynb-trigger-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
  `;

  /**
   * スタイルシートを注入
   */
  function injectStyles() {
    if (document.getElementById('ynb-styles')) return;

    const style = document.createElement('style');
    style.id = 'ynb-styles';
    style.textContent = MODAL_STYLES;
    document.head.appendChild(style);
  }

  /**
   * モーダルを作成
   * @returns {HTMLElement}
   */
  function createModal() {
    const overlay = document.createElement('div');
    overlay.className = 'ynb-overlay';
    overlay.id = 'ynb-modal-overlay';

    overlay.innerHTML = `
      <div class="ynb-modal">
        <div class="ynb-header">
          <h1>弥生NEXTブリッジ</h1>
          <p>給与NEXT → 会計NEXT データ変換</p>
        </div>
        <div class="ynb-content">
          <div class="ynb-dropzone" id="ynb-dropzone">
            <input type="file" class="ynb-file-input" id="ynb-file-input" accept=".txt,.csv">
            <div class="ynb-dropzone-icon">📁</div>
            <div class="ynb-dropzone-text">ファイルを選択またはドラッグ&ドロップ</div>
          </div>
          <div class="ynb-file-info" id="ynb-file-info">
            <strong>選択中:</strong> <span id="ynb-file-name"></span>
            (<span id="ynb-file-size"></span>)
          </div>
          <div class="ynb-result" id="ynb-result"></div>
          <div class="ynb-buttons">
            <button class="ynb-btn ynb-btn-secondary" id="ynb-close-btn">閉じる</button>
            <button class="ynb-btn ynb-btn-primary" id="ynb-convert-btn" disabled>変換する</button>
          </div>
        </div>
        <div class="ynb-footer">
          ⚠️ 非公式ツール ｜ 🔒 すべての処理はローカルで実行
        </div>
      </div>
    `;

    return overlay;
  }

  /**
   * ファイルサイズをフォーマット
   * @param {number} bytes
   * @returns {string}
   */
  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * ファイルをダウンロード
   * @param {string} fileName
   * @param {Uint8Array} content
   */
  function downloadFile(fileName, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * モーダルを表示し、イベントをバインド
   */
  function showModal() {
    // 既存のモーダルがあれば削除
    const existing = document.getElementById('ynb-modal-overlay');
    if (existing) existing.remove();

    const overlay = createModal();
    document.body.appendChild(overlay);

    // 要素の参照を取得
    const dropzone = document.getElementById('ynb-dropzone');
    const fileInput = document.getElementById('ynb-file-input');
    const fileInfo = document.getElementById('ynb-file-info');
    const fileName = document.getElementById('ynb-file-name');
    const fileSize = document.getElementById('ynb-file-size');
    const convertBtn = document.getElementById('ynb-convert-btn');
    const closeBtn = document.getElementById('ynb-close-btn');
    const resultDiv = document.getElementById('ynb-result');

    let selectedFile = null;

    // ドロップゾーンクリック
    dropzone.addEventListener('click', () => fileInput.click());

    // ファイル選択
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) selectFile(file);
    });

    // ドラッグ&ドロップ
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.txt') || file.name.endsWith('.csv'))) {
        selectFile(file);
      } else {
        alert('対応ファイル形式: .txt, .csv');
      }
    });

    // ファイル選択処理
    function selectFile(file) {
      selectedFile = file;
      fileName.textContent = file.name;
      fileSize.textContent = formatFileSize(file.size);
      fileInfo.classList.add('visible');
      convertBtn.disabled = false;
      resultDiv.classList.remove('visible');
    }

    // 変換ボタン
    convertBtn.addEventListener('click', async () => {
      if (!selectedFile) return;

      convertBtn.disabled = true;
      convertBtn.textContent = '変換中...';

      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const inputText = decodeShiftJIS(arrayBuffer);
        const { outputText, result } = convertCSVText(inputText);

        resultDiv.classList.add('visible');

        if (result.success) {
          resultDiv.className = 'ynb-result visible success';
          resultDiv.innerHTML = `
            ✅ 変換成功<br>
            伝票数: ${result.slipCount}件 ｜ 行数: ${result.rowCount}行
          `;

          const outputBuffer = encodeShiftJIS(outputText);
          const outputFileName = selectedFile.name.replace(
            /\.(txt|csv)$/i,
            '_弥生会計NEXT用.txt'
          );
          downloadFile(outputFileName, outputBuffer);
        } else {
          resultDiv.className = 'ynb-result visible error';
          resultDiv.innerHTML = `❌ 変換失敗<br>${result.errorMessage}`;
        }
      } catch (error) {
        resultDiv.className = 'ynb-result visible error';
        resultDiv.innerHTML = `❌ エラー<br>${error.message}`;
      } finally {
        convertBtn.disabled = false;
        convertBtn.textContent = '変換する';
      }
    });

    // 閉じるボタン
    closeBtn.addEventListener('click', () => overlay.remove());

    // オーバーレイクリックで閉じる
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // ESCキーで閉じる
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  // ============================================================
  // トリガーボタン（インポートページに表示）
  // ============================================================

  /**
   * インポートページかどうか判定
   * @returns {boolean}
   */
  function isImportPage() {
    return window.location.pathname.startsWith(IMPORT_PAGE_PATH);
  }

  /**
   * トリガーボタンを作成
   * @returns {HTMLButtonElement}
   */
  function createTriggerButton() {
    const button = document.createElement('button');
    button.id = 'ynb-trigger-btn';
    button.className = 'ynb-trigger-btn';
    button.textContent = '📁 給与データを変換';
    button.addEventListener('click', showModal);
    return button;
  }

  /**
   * トリガーボタンを注入
   */
  function injectTriggerButton() {
    if (document.getElementById('ynb-trigger-btn')) return;
    document.body.appendChild(createTriggerButton());
  }

  /**
   * トリガーボタンを削除
   */
  function removeTriggerButton() {
    const button = document.getElementById('ynb-trigger-btn');
    if (button) button.remove();
  }

  /**
   * ページに応じてボタン表示を更新
   */
  function updateButtonVisibility() {
    if (isImportPage()) {
      injectTriggerButton();
    } else {
      removeTriggerButton();
    }
  }

  // ============================================================
  // 初期化
  // ============================================================

  function init() {
    injectStyles();
    updateButtonVisibility();

    // SPA遷移を監視
    let lastUrl = window.location.href;

    window.addEventListener('popstate', updateButtonVisibility);

    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        updateButtonVisibility();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // 実行
  init();
})();
