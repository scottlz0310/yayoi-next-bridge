/**
 * Side Panel ロジック
 *
 * ファイル選択 → 変換 → ダウンロード の流れを実装
 */
import { convertCSVText } from '../converter/converter.ts';
import { decodeShiftJIS, encodeShiftJIS } from '../lib/encoding.ts';

// DOM要素の参照
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const fileInfo = document.getElementById('fileInfo') as HTMLDivElement;
const convertButton = document.getElementById('convertButton') as HTMLButtonElement;
const resultSection = document.getElementById('resultSection') as HTMLElement;
const resultStatus = document.getElementById('resultStatus') as HTMLSpanElement;
const resultSlipCount = document.getElementById('resultSlipCount') as HTMLSpanElement;
const resultRowCount = document.getElementById('resultRowCount') as HTMLSpanElement;
const errorMessage = document.getElementById('errorMessage') as HTMLDivElement;
const dropZone = document.getElementById('dropZone') as HTMLDivElement;

// 選択されたファイル
let selectedFile: File | null = null;

/**
 * ファイルサイズを人間が読める形式にフォーマット
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * ファイルを選択状態にする（共通処理）
 */
function selectFile(file: File): void {
  selectedFile = file;

  // ファイル情報を表示
  const fileName = fileInfo.querySelector('.file-name');
  const fileSize = fileInfo.querySelector('.file-size');
  if (fileName && fileSize) {
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
  }
  fileInfo.classList.remove('hidden');

  // 変換ボタンを有効化
  convertButton.disabled = false;

  // 前回の結果をクリア
  resultSection.classList.add('hidden');
}

/**
 * ファイル選択時の処理
 */
fileInput.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) {
    selectedFile = null;
    fileInfo.classList.add('hidden');
    convertButton.disabled = true;
    return;
  }

  selectFile(file);
});

/**
 * ドラッグ&ドロップのイベント処理
 */

// ドラッグ進入時
dropZone.addEventListener('dragenter', (event) => {
  event.preventDefault();
  event.stopPropagation();
  dropZone.classList.add('drag-over');
});

// ドラッグ中
dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  event.stopPropagation();
  dropZone.classList.add('drag-over');
});

// ドラッグ離脱時
dropZone.addEventListener('dragleave', (event) => {
  event.preventDefault();
  event.stopPropagation();
  dropZone.classList.remove('drag-over');
});

// ドロップ時
dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  event.stopPropagation();
  dropZone.classList.remove('drag-over');

  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (!file) {
      return;
    }
    // .txt または .csv ファイルのみ受け付ける
    if (file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
      selectFile(file);
    } else {
      alert('対応ファイル形式: .txt, .csv');
    }
  }
});

/**
 * ファイルをダウンロード
 */
function downloadFile(fileName: string, content: ArrayBuffer): void {
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
 * 変換処理
 */
async function performConversion(): Promise<void> {
  if (!selectedFile) {
    return;
  }

  // ボタンを無効化
  convertButton.disabled = true;
  convertButton.textContent = '変換中...';

  try {
    // ファイルをArrayBufferとして読み込み
    const arrayBuffer = await selectedFile.arrayBuffer();

    // Shift-JISデコード
    const inputText = decodeShiftJIS(arrayBuffer);

    // 変換処理
    const { outputText, result } = convertCSVText(inputText, {
      inputFileName: selectedFile.name,
    });

    // 結果を表示
    resultSection.classList.remove('hidden');

    if (result.success) {
      // 成功
      resultStatus.textContent = '✅ 変換成功';
      resultStatus.className = 'result-value success';
      resultSlipCount.textContent = `${result.slipCount}件`;
      resultRowCount.textContent = `${result.rowCount}行`;
      errorMessage.classList.add('hidden');

      // Shift-JISエンコード
      const outputBuffer = encodeShiftJIS(outputText);

      // 出力ファイル名を生成（元のファイル名に「_弥生会計NEXT用」を追加）
      const outputFileName = selectedFile.name.replace(/\.(txt|csv)$/i, '_弥生会計NEXT用.txt');

      // ダウンロード
      downloadFile(outputFileName, outputBuffer);
    } else {
      // 失敗
      resultStatus.textContent = '❌ 変換失敗';
      resultStatus.className = 'result-value error';
      resultSlipCount.textContent = '-';
      resultRowCount.textContent = '-';

      // エラーメッセージを表示
      if (result.errorMessage) {
        errorMessage.textContent = `エラー: ${result.errorMessage}`;
        errorMessage.classList.remove('hidden');
      }
    }
  } catch (error) {
    // 予期しないエラー
    resultSection.classList.remove('hidden');
    resultStatus.textContent = '❌ エラー';
    resultStatus.className = 'result-value error';
    resultSlipCount.textContent = '-';
    resultRowCount.textContent = '-';

    const message = error instanceof Error ? error.message : '不明なエラーが発生しました';
    errorMessage.textContent = `エラー: ${message}`;
    errorMessage.classList.remove('hidden');
  } finally {
    // ボタンを再度有効化
    convertButton.disabled = false;
    convertButton.textContent = '変換する';
  }
}

/**
 * 変換ボタンのクリックイベント
 */
convertButton.addEventListener('click', () => {
  performConversion().catch((error) => {
    console.error('変換処理でエラーが発生しました:', error);
  });
});
