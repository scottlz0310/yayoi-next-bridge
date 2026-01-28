# 弥生NEXTブリッジ - Tampermonkey版

弥生給与NEXTのデータを弥生会計NEXTのインポート形式に変換するTampermonkey/Greasemonkeyユーザースクリプト。

## 特徴

- **インストール簡単** - ワンクリックでインストール
- **審査不要** - Chrome Web Store審査なし
- **クロスブラウザ** - Chrome (Tampermonkey) / Firefox (Greasemonkey) 対応
- **ローカル処理** - すべての処理はブラウザ内で完結

## インストール方法

### 1. Tampermonkeyをインストール

- [Chrome版Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox版Greasemonkey](https://addons.mozilla.org/ja/firefox/addon/greasemonkey/)

### 2. ユーザースクリプトをインストール

以下のいずれかの方法でインストール:

#### 方法A: ファイルを直接開く
1. `yayoi-next-bridge.user.js` をダウンロード
2. Tampermonkeyアイコンをクリック → 「新規スクリプトを作成」
3. ファイルの内容をコピー&ペースト → 保存

#### 方法B: URLから直接インストール
1. `yayoi-next-bridge.user.js` のRaw URLにアクセス
2. Tampermonkeyが自動でインストール画面を表示

## 使い方

1. [弥生会計NEXT](https://next-kaikei.yayoi-kk.co.jp/) にログイン
2. 「データ管理」→「インポート」画面に移動
3. 右上に表示される「📁 給与データを変換」ボタンをクリック
4. 弥生給与NEXTからエクスポートしたファイルを選択
5. 「変換する」ボタンをクリック
6. 変換されたファイルが自動ダウンロード

## Chrome拡張版との違い

| 機能 | Chrome拡張版 | Tampermonkey版 |
|------|-------------|---------------|
| UI形式 | Side Panel | モーダルダイアログ |
| インストール | Chrome Web Store | スクリプトコピー |
| ビルド | 必要 (Vite) | 不要 |
| テスト環境 | Vitest | なし |
| TypeScript | ✅ | ❌ (JavaScript) |

## 動作環境

- Chrome + Tampermonkey
- Firefox + Greasemonkey / Tampermonkey
- Edge + Tampermonkey

## 注意事項

⚠️ このツールは弥生株式会社の公式ツールではありません。

🔒 すべての処理はローカルで実行され、外部サーバーへの送信は一切ありません。

## 技術的な制限

- 外部ライブラリ依存: [encoding-japanese](https://github.com/polygonplanet/encoding-japanese) をCDNから読み込んでいます。オフライン環境では動作しません。

## ライセンス

MIT License
