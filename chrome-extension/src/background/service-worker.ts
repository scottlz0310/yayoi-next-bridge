/**
 * Service Worker
 *
 * バックグラウンドで動作し、拡張機能のライフサイクルを管理する
 */

// インストール時の処理
chrome.runtime.onInstalled.addListener(() => {
  console.log('弥生NEXTブリッジがインストールされました');
});

// アクションアイコンクリック時にSide Panelを開く
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id }).catch((error) => {
      console.error('Side Panelを開けませんでした:', error);
    });
  }
});

// Content Scriptからのメッセージを処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openSidePanel' && sender.tab?.id) {
    chrome.sidePanel
      .open({ tabId: sender.tab.id })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Side Panelを開けませんでした:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 非同期レスポンスを送信することを示す
  }
  return false;
});
