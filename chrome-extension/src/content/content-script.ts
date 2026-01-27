/**
 * Content Script
 *
 * 弥生会計NEXTのインポート画面に最小限のUIを注入する
 * - ボタン1個のみ
 * - クリックでSide Panelを開く
 */

// ボタンを作成
function createBridgeButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = 'yayoi-next-bridge-button';
  button.textContent = '📁 給与データを変換';
  button.style.cssText = `
    position: fixed;
    top: 20px;
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
    chrome.runtime
      .sendMessage({ action: 'openSidePanel' })
      .then(() => {
        console.log('Side Panelを開きました');
      })
      .catch((error) => {
        console.error('Side Panelを開けませんでした:', error);
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
  console.log('弥生NEXTブリッジのボタンを注入しました');
}

// DOMContentLoaded後に注入
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectButton);
} else {
  injectButton();
}
