# Chrome拡張化 実装計画書

> **Issue原稿として使用可能**  
> このドキュメントはGitHub Issueにそのままコピーして使用できます。

## 概要

弥生NEXTブリッジをChrome拡張として実装し、弥生会計NEXT/弥生給与NEXTのWebアプリケーションとシームレスに連携させる。

## 背景

### 現状
- 弥生給与NEXTからエクスポートした仕訳データは、弥生会計NEXTにそのままインポートできない
- 現在の解決策：スタンドアロンの変換ツール（Python/NiceGUI）
- ユーザーは「エクスポート → 変換ツール起動 → 変換 → インポート」という手順が必要

### 課題
- ツールの起動が手間
- ファイルの受け渡しが煩雑
- 弥生NEXTとの画面切り替えが発生

### 解決策
Chrome拡張として弥生NEXTのページ内に変換機能を統合することで、ワンクリックでの変換を実現する。

## セキュリティ・プライバシー方針

> **重要**: この拡張は以下を保証する

- ✅ 入力ファイルは**ローカル処理のみ**（外部サーバーへの送信なし）
- ✅ ネットワーク通信なし（変換処理は完全オフライン）
- ✅ 弥生NEXT の認証情報・Cookie には一切アクセスしない
- ✅ 変換処理は**決定的**（同一入力に対して常に同一出力）
- ✅ 入力が不正な場合は**変換しない**（部分成功禁止）

## 実装アプローチの比較

| アプローチ | 変換処理の場所 | 複雑度 | ローカル依存 | UX |
|-----------|---------------|--------|-------------|-----|
| **Pure JS** | ブラウザ内JavaScript | ★★☆☆☆ | なし | ◎ |
| **Hybrid** | NiceGUIサーバー連携 | ★★★☆☆ | Pythonサーバー必要 | △ |
| **Native Messaging** | Pythonスクリプト直接呼出 | ★★★★☆ | Python + レジストリ設定 | △ |

### 推奨: Pure JS アプローチ

**理由:**
1. 変換ロジックがシンプル（CSV読み込み → フィールド変換 → CSV書き出し）
2. 外部依存なしでインストールが簡単
3. Shift-JIS対応もJavaScriptで可能（`TextDecoder` / `encoding.js`）
4. 弥生NEXTとの連携がスムーズ

## 機能要件

### MVP（最小限の実装）
- [ ] Side Panel UIでファイル選択→変換→ダウンロードができる
- [ ] 弥生会計NEXTインポート画面を開いている時のみ導線表示
- [ ] 変換後ファイルの自動ダウンロード
- [ ] エラーハンドリングとユーザー通知（原因表示）
- [ ] 変換サマリ表示（成功/失敗/警告件数）

### 将来的な拡張
- [ ] 弥生給与NEXTのエクスポート画面での自動変換
- [ ] 変換履歴の保存
- [ ] 設定画面（税区分のカスタマイズなど）
- [ ] 複数ファイルの一括変換

## 技術仕様

### ディレクトリ構造

```
chrome-extension/
├── manifest.json           # Chrome拡張マニフェスト（v3）
├── src/
│   ├── background/
│   │   └── service-worker.ts   # Service Worker
│   ├── content/
│   │   └── content-script.ts   # 弥生NEXTページへの最小限UI注入（ボタンのみ）
│   ├── panel/
│   │   ├── panel.html          # Side Panel UI
│   │   ├── panel.ts            # Side Panel ロジック
│   │   └── panel.css           # スタイル
│   ├── converter/
│   │   ├── types.ts            # 型定義（PayrollEntry, AccountingEntry）
│   │   ├── converter.ts        # 変換ロジック（Pythonから移植）
│   │   └── csv.ts              # CSV読み書き（行配列基準）
│   └── lib/
│       └── encoding.ts         # Shift-JIS エンコーディング処理
├── assets/
│   └── icons/                  # 拡張アイコン
├── tests/
│   └── converter.test.ts       # 変換ロジックのテスト
├── package.json
├── tsconfig.json
├── biome.json                  # Linter/Formatter設定
└── vite.config.ts              # ビルド設定
```

### UI方針: Side Panel を採用

**Popup ではなく Side Panel を採用する理由:**

| 観点 | Popup | Side Panel |
|------|-------|------------|
| UI領域 | 小さい（窮屈） | 広い（アプリ感） |
| 常駐性 | クリックで消える | 開いたまま作業可能 |
| ログ・エラー表示 | 困難 | 余裕あり |
| 弥生NEXTとの併用 | 画面切替必要 | 並列表示可能 |

> **Side Panel API**: Chrome 114+ で利用可能。業務用途なので最新Chrome前提で問題なし。

### Content Script 設計方針

**原則: DOM依存を最小化する**

Content Scriptは以下のみを担当：
- ✅ 小さなボタン1個の注入
- ✅ ボタンクリックでSide Panelを開く導線

**Content Scriptでやらないこと:**
- ❌ フォーム表示
- ❌ ログ・進捗表示
- ❌ ファイル選択UI
- ❌ エラー表示

これにより、弥生NEXTのDOM構造変更への耐性を最大化する。

### 技術スタック

| カテゴリ | 技術 |
|---------|------|
| 言語 | TypeScript（strict mode） |
| ビルド | Vite + CRXJS |
| Lint/Format | Biome |
| テスト | Vitest |
| エンコーディング | encoding.js または iconv-lite（ブラウザ版） |

### Shift-JIS対応

**方針: encoding-japanese に統一**（読み書き両方）

`TextDecoder('shift_jis')` は環境差が出る可能性があるため、encoding-japanese ライブラリに統一する。

```typescript
import Encoding from 'encoding-japanese';

// 読み込み（ArrayBuffer → string）
function decodeShiftJIS(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  const unicodeArray = Encoding.convert(uint8Array, {
    to: 'UNICODE',
    from: 'SJIS',
  });
  return Encoding.codeToString(unicodeArray);
}

// 書き出し（string → ArrayBuffer）
function encodeShiftJIS(text: string): ArrayBuffer {
  const unicodeArray = Encoding.stringToCode(text);
  const sjisArray = Encoding.convert(unicodeArray, {
    to: 'SJIS',
    from: 'UNICODE',
  });
  return new Uint8Array(sjisArray).buffer;
}
```

### 変換処理の設計方針

**コア表現: `Array<Array<string>>`（行×列の2次元配列）**

```
[入力ファイル]
    ↓ decodeShiftJIS
[文字列]
    ↓ parseCSV
[Array<Array<string>>] ← コア表現（ここでテスト）
    ↓ transform（1:1変換）
[Array<Array<string>>]
    ↓ stringifyCSV
[文字列]
    ↓ encodeShiftJIS
[出力ファイル]
```

**メリット:**
- 改行コード（CRLF/LF）の問題を切り離せる
- CSV引用符・カンマ含み文字列の処理を共通化
- テストが安定する（行配列の比較で完結）

### 変換ロジックの移植

Python実装からTypeScriptへの1:1移植（`reference/` と `yayoi_next_bridge/` の既存実装・ドキュメントを参照）：

```typescript
// types.ts
interface PayrollEntry {
  flag: string;           // 識別フラグ (0110/0100/0101)
  unknown: string;
  dateRaw: string;        // YYYYMMDD
  debitAccount: string;
  debitSub: string;
  debitAmount: string;
  creditAccount: string;
  creditSub: string;
  creditAmount: string;
  description: string;
}

interface AccountingEntry {
  flag: string;           // 識別フラグ (2110/2100/2101)
  slipNo: string;
  settlement: string;
  date: string;           // YYYY/MM/DD
  // ... 25項目
}
```

### Content Script の注入対象

**方針: 権限は最小限に絞る**

広すぎる `matches` は以下の問題を引き起こす：
- 予期しないページでcontent scriptが動作
- Chrome Web Store審査で「権限が広い」扱い
- ユーザーからの不信感

```json
{
  "content_scripts": [
    {
      "matches": [
        "https://app.yayoi-kk.co.jp/ac-next/*/import*"
      ],
      "js": ["src/content/content-script.ts"]
    }
  ],
  "side_panel": {
    "default_path": "src/panel/panel.html"
  },
  "permissions": [
    "sidePanel"
  ],
  "host_permissions": [
    "https://app.yayoi-kk.co.jp/ac-next/*"
  ]
}
```

> **Note**: 実際のURLパターンは弥生NEXTの画面を確認して調整する。  
> MVPでは「会計NEXTインポート画面」のみに絞り、段階的に拡張する。

## タスクリスト

### Phase 1: 基盤構築
- [ ] Chrome拡張プロジェクトの初期セットアップ
- [ ] TypeScript + Vite + CRXJS の設定
- [ ] Biome（Lint/Format）���設定
- [ ] 基本的なmanifest.json作成（Side Panel対応）

**Done条件:**
- `npm run build` でエラーなくビルドできる
- Chromeに読み込んでSide Panelが開ける

### Phase 2: 変換ロジック移植
- [ ] 既存実装（`reference/` と `yayoi_next_bridge/`）と既存ドキュメントを参照して差分を確認
- [ ] 型定義（PayrollEntry, AccountingEntry）
- [ ] Shift-JISエンコーディング処理（encoding-japanese）
- [ ] CSV読み書きユーティリティ（行配列基準）
- [ ] 変換ロジック本体
- [ ] ユニットテスト

**Done条件:**
- 以下3ケースのテストがパスする
  - 正常系（標準的な入力）
  - 文字コード系（Shift-JIS入出力）
  - 異常系（列不足・空行など）
- 既存実装との差分が記録されている

### Phase 3a: Side Panel UI（単体動作）
- [ ] Side Panel UI（ファイル選択→変換→ダウンロード）
- [ ] 変換サマリ表示（成功/失敗/警告件数）
- [ ] エラーハンドリングと原因表示
- [ ] Content Script なしで動作確認

**Done条件:**
- 拡張単体でファイル変換→ダウンロードできる
- 失敗時に原因が表示される

### Phase 3b: 弥生NEXT連携
- [ ] 弥生NEXTインポート画面でボタン注入
- [ ] ボタンクリックでSide Panelを開く
- [ ] 対象ページ以外では非表示

**Done条件:**
- 弥生会計NEXTインポート画面でボタンが表示される
- ボタンクリックでSide Panelが開く
- 他のページでは何も表示されない

### Phase 4: テスト・リリース
- [ ] E2Eテスト
- [ ] Chrome Web Storeへの公開準備
- [ ] ドキュメント整備（README、プライバシーポリシー）

**Done条件:**
- Chrome Web Store審査に提出できる状態

## 既存実装との関係

| 実装 | 用途 | 状態 |
|------|------|------|
| `reference/` | プロトタイプ・参照実装 | 完成（維持） |
| `yayoi_next_bridge/` | スタンドアロン版（Python/NiceGUI） | 完成（維持） |
| `chrome-extension/` | Chrome拡張版（TypeScript） | **新規作成** |

スタンドアロン版は「Chrome以外のブラウザユーザー」「オフライン環境」向けとして維持する。

> **移植時の参照方針**: `reference/` と `yayoi_next_bridge/` の実装・ドキュメントを参照し、仕様差分を記録する。

## 参考リンク

- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin/)
- [encoding-japanese](https://github.com/nicejmp/encoding.js)
- [弥生会計NEXT インポート仕様](https://support.yayoi-kk.co.jp/subcontents.html?page_id=29611)

## 備考

- 弥生NEXTのDOM構造は変更される可能性があるため、Content Scriptは**ボタン1個だけ**に限定
- Chrome Web Store公開時はプライバシーポリシーが必要
- Manifest V3の制約（Service Worker、リモートコード禁止など）に注意
- Side Panel APIはChrome 114+が必要（業務用途なので問題なし）