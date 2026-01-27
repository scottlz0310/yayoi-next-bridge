# 弥生NEXTブリッジ - Chrome拡張

[![CI](https://github.com/scottlz0310/yayoi-next-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/scottlz0310/yayoi-next-bridge/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/scottlz0310/yayoi-next-bridge/graph/badge.svg?flag=chrome-extension)](https://codecov.io/gh/scottlz0310/yayoi-next-bridge)

弥生給与NEXTのエクスポートデータを弥生会計NEXTのインポート形式に変換するChrome拡張機能です。

## 特徴

- ✅ **完全オフライン処理**: すべての変換処理はブラウザ内で完結（外部サーバーへの送信なし）
- ✅ **セキュア**: 弥生NEXTの認証情報・Cookieには一切アクセスしません
- ✅ **決定的**: 同一入力に対して常に同一出力を保証
- ✅ **ドラッグ&ドロップ**: ファイル選択もD&Dで簡単操作
- ✅ **シームレス**: Side Panel UIで弥生NEXTと並行して作業可能
- ✅ **Shift-JIS完全対応**: 日本語文字コードを正しく処理

## インストール（開発版）

### 前提条件

- Node.js 18以上
- Chrome 114以上（Side Panel API対応）

### セットアップ

```bash
cd chrome-extension
npm install
npm run build
```

### Chromeへの読み込み

1. Chromeで `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `chrome-extension/dist` ディレクトリを選択

## 使い方

### 基本的な使い方

1. 弥生会計NEXTのインポート画面（`設定` → `データ管理` → `インポート`）を開く
2. 画面右上の「📁 給与データを変換」ボタンをクリック
3. Side Panelが開くので、以下のいずれかで変換するファイルを選択：
   - **ドラッグ&ドロップ**: ファイルをドロップエリアにドラッグ
   - **ボタンクリック**: 「ファイルを選択」ボタンから選択
4. 変換が成功すると、自動的にダウンロードが開始されます
5. ダウンロードされたファイルをそのまま弥生会計NEXTにインポート！

> 💡 **Tips**: 変換後のダウンロードファイルから直接インポートボタンへD&Dすると、流れが途切れず効率的です！

### 対応ファイル形式

- **入力**: 弥生給与NEXTの仕訳データ（14項目、Shift-JIS、CSV形式）
- **出力**: 弥生会計NEXTインポート形式（25項目、Shift-JIS、CSV形式）

出力ファイル名は元のファイル名に `_弥生会計NEXT用` が追加されます。

## 開発

### 開発サーバーの起動

```bash
npm run dev
```

### テストの実行

```bash
npm test           # 全テストを実行
npm test -- --ui   # UIでテストを実行
```

### Lint/Format

```bash
npm run lint       # Lintチェック
npm run lint:fix   # 自動修正
npm run format     # フォーマット
```

### ビルド

```bash
npm run build      # 本番ビルド
```

## 技術スタック

- **言語**: TypeScript（strict mode）
- **ビルドツール**: Vite + CRXJS
- **Lint/Format**: Biome
- **テスト**: Vitest
- **文字コード処理**: encoding-japanese
- **Chrome API**: Manifest V3、Side Panel API

## プロジェクト構造

```
chrome-extension/
├── src/
│   ├── background/         # Service Worker
│   ├── content/            # Content Script（ボタン注入のみ）
│   ├── panel/              # Side Panel UI
│   ├── converter/          # 変換ロジック
│   └── lib/                # ユーティリティ
├── tests/                  # ユニットテスト
├── assets/                 # アイコンなど
├── manifest.json           # Chrome拡張マニフェスト
└── package.json
```

## セキュリティ・プライバシー

この拡張は以下を保証します：

- ✅ 入力ファイルは**ローカル処理のみ**（外部サーバーへの送信なし）
- ✅ ネットワーク通信なし（変換処理は完全オフライン）
- ✅ 弥生NEXTの認証情報・Cookieには一切アクセスしない
- ✅ 変換処理は**決定的**（同一入力に対して常に同一出力）
- ✅ 入力が不正な場合は**変換しない**（部分成功禁止）

## ライセンス

MIT License

## 免責

本ツールは弥生株式会社の公式ツールではありません。利用は自己責任でお願いします。

## 参考リンク

- [弥生会計NEXT インポート仕様](https://support.yayoi-kk.co.jp/subcontents.html?page_id=29611)
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
