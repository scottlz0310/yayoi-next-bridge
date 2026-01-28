# 弥生NEXTブリッジ（yayoi-next-bridge）

[![CI](https://github.com/scottlz0310/yayoi-next-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/scottlz0310/yayoi-next-bridge/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/scottlz0310/yayoi-next-bridge/graph/badge.svg)](https://codecov.io/gh/scottlz0310/yayoi-next-bridge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

弥生給与Next のエクスポート出力を、弥生会計Next のインポートで取り込める形式に変換するためのコンバーターです。  
（給与Next と 会計Next の間の "微妙な非互換" を吸収します）

## 🚀 クイックスタート（Chrome拡張）

最も簡単に使える方法です。**弥生会計NEXT画面で直接変換できます**。

### インストール

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

### 使い方

1. **弥生会計NEXT**のインポート画面（`設定` → `データ管理` → `インポート`）を開く
2. 画面右上の「📁 給与データを変換」ボタンをクリック
3. Side Panelが開くので、変換したい給与データファイルを**ドラッグ&ドロップ**
4. 自動的に変換され、ダウンロードが開始されます
5. ダウンロードされたファイルをそのまま弥生会計NEXTのインポートへ！

> 💡 **Tips**: 変換後のダウンロードファイルから直接インポートボタンへD&Dすると、流れが途切れず効率的です！

## 📦 実装

**Chrome拡張**が推奨の実装です。

| 実装 | 場所 | ステータス | 特徴 |
|------|------|------------|------|
| **Chrome拡張** ✨ | `chrome-extension/` | ✅ 安定版 | 弥生画面で直接変換、D&D対応 |
| Tampermonkey | `tampermonkey/` | ✅ 軽量版 | 単一ファイル、ビルド不要 |
| Pythonスクリプト | `archive/reference/` | 📦 アーカイブ | CLI、一括変換対応 |
| Python GUI | `archive/yayoi_next_bridge/` | 📦 アーカイブ | NiceGUIプロトタイプ |

> 💡 **Tampermonkey版**: 開発者・パワーユーザー向けの軽量実装です。[Tampermonkey](https://www.tampermonkey.net/)がインストール済みなら、[yayoi-next-bridge.user.js](tampermonkey/yayoi-next-bridge.user.js) のRaw URLから直接インストールできます。

## ✨ 特徴

- ✅ **完全オフライン**: すべての処理はローカルで完結（外部サーバーへの送信なし）
- ✅ **セキュア**: 弥生NEXTの認証情報・Cookieには一切アクセスしません
- ✅ **決定的**: 同一入力に対して常に同一出力を保証
- ✅ **Shift-JIS完全対応**: 日本語文字コードを正しく処理
- ✅ **ドラッグ&ドロップ**: ファイル選択の手間を最小化

## 🎯 できること / できないこと

### ✅ できること

- 弥生給与Next の出力データを、弥生会計Next で取り込める形式に変換
- Chrome拡張でシームレスな変換体験
- Shift-JISエンコーディングの維持
- 入力ファイルのバリデーション

### ❌ できないこと（スコープ外）

- 会計処理や仕訳ルールの自動生成など、業務判断が必要な処理
- 変換処理を “賢くする” 方向の拡張（AI活用など）
- データの自動アップロード・外部送信

本ツールは **「確実に変換できる」「迷わず使える」** を優先します。

## 👤 想定ユーザー

- 弥生給与Next → 弥生会計Next の連携で困っている人
- 変換作業を手作業で整形していて、毎回時間が溶けている人
- 公式の対応を待っていられない人

## 🛠️ 技術スタック

| 項目 | 技術 |
|------|------|
| 言語 | TypeScript（strict mode） |
| ビルド | Vite + CRXJS |
| Lint/Format | Biome |
| テスト | Vitest |
| 文字コード | encoding-japanese |
| Chrome API | Manifest V3, Side Panel API |

## 📁 ディレクトリ構成

```text
.
├─ chrome-extension/          # Chrome拡張機能（メイン）
│  ├─ src/
│  │  ├─ converter/           # 変換ロジック
│  │  ├─ panel/               # Side Panel UI
│  │  ├─ content/             # Content Script
│  │  └─ background/          # Service Worker
│  └─ tests/                  # テスト
├─ tampermonkey/              # Tampermonkey版（軽量実装）
├─ scripts/                   # リリーススクリプト
├─ docs/                      # ドキュメント
└─ archive/                   # アーカイブ（Python版）
   ├─ reference/              # 参考実装（Python/PowerShell）
   └─ yayoi_next_bridge/      # NiceGUI版プロトタイプ
```

## 🧪 開発

```bash
cd chrome-extension
npm install
npm run dev          # 開発サーバー（ホットリロード）
npm run test         # テスト実行
npm run lint         # Lintチェック
npm run build        # 本番ビルド
```

リリース手順は [docs/release.md](docs/release.md) を参照してください。

## 📄 ライセンス

MIT License

## ⚠️ 免責

本ツールは弥生株式会社の公式ツールではありません。利用は自己責任でお願いします。

## 🔗 参考リンク

- [弥生会計NEXT インポート仕様](https://support.yayoi-kk.co.jp/subcontents.html?page_id=29611)
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)