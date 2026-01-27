/**
 * Content Script
 *
 * 弥生会計NEXTのインポート画面に最小限のUIを注入する
 * - ボタン1個のみ
 * - クリックでSide Panelを開く
 * - SPAのURL変化を監視して表示/非表示を切り替え
 */

const IMPORT_PAGE_PATH = '/config/data-management/import';

/**
 * 現在のURLがインポートページかどうかを判定
 */
function isImportPage(): boolean {
  return window.location.pathname.startsWith(IMPORT_PAGE_PATH);
}

// ボタンを作成
function createBridgeButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = 'yayoi-next-bridge-button';
  button.textContent = '📁 給与データを変換';
  button.style.cssText = `
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
  `;

  // ホバー効果
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-2px)';
    button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
  });

  // クリックでSide Panelを開く
  button.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openSidePanel' }).catch(() => {
      // エラーは無視（Side Panelが開けない環境等）
    });
  });

  return button;
}

// ボタンを注入
function injectButton(): void {
  // 既にボタンが存在する場合はスキップ
  if (document.getElementById('yayoi-next-bridge-button')) {
    return;
  }

  const button = createBridgeButton();
  document.body.appendChild(button);
}

// ボタンを削除
function removeButton(): void {
  const button = document.getElementById('yayoi-next-bridge-button');
  if (button) {
    button.remove();
  }
}

// URLに応じてボタンの表示/非表示を更新
function updateButtonVisibility(): void {
  if (isImportPage()) {
    injectButton();
  } else {
    removeButton();
  }
}

// 初回チェック
updateButtonVisibility();

// SPA遷移を監視（History APIのフック）
let lastUrl = window.location.href;

// popstateイベント（ブラウザの戻る/進む）
window.addEventListener('popstate', () => {
  updateButtonVisibility();
});

// MutationObserverでURL変化を検出（pushState/replaceState対応）
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
