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
- [ ] 弥生会計NEXTのインポート画面で動作
- [ ] ファイル選択による変換
- [ ] 変換後ファイルの自動ダウンロード
- [ ] エラーハンドリングとユーザー通知

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
│   │   └── content-script.ts   # 弥生NEXTページへのUI注入
│   ├── popup/
│   │   ├── popup.html          # ポップアップUI
│   │   ├── popup.ts            # ポップアップロジック
│   │   └── popup.css           # スタイル
│   ├── converter/
│   │   ├── types.ts            # 型定義（PayrollEntry, AccountingEntry）
│   │   ├── converter.ts        # 変換ロジック（Pythonから移植）
│   │   └── encoding.ts         # Shift-JIS エンコーディング処理
│   └── utils/
│       └── csv.ts              # CSV読み書きユーティリティ
├── assets/
│   └── icons/                  # 拡張アイコン
├── tests/
│   └── converter.test.ts       # 変換ロジックのテスト
├── package.json
├── tsconfig.json
├── biome.json                  # Linter/Formatter設定
└── vite.config.ts              # ビルド設定
```

### 技術スタック

| カテゴリ | 技術 |
|---------|------|
| 言語 | TypeScript（strict mode） |
| ビルド | Vite + CRXJS |
| Lint/Format | Biome |
| テスト | Vitest |
| エンコーディング | encoding.js または iconv-lite（ブラウザ版） |

### Shift-JIS対応

```typescript
// 読み込み
const decoder = new TextDecoder('shift_jis');
const text = decoder.decode(arrayBuffer);

// 書き出し（encoding.jsを使用）
import Encoding from 'encoding-japanese';
const sjisArray = Encoding.convert(text, {
  to: 'SJIS',
  from: 'UNICODE',
  type: 'arraybuffer'
});
```

### 変換ロジックの移植

Python実装からTypeScriptへの1:1移植：

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

```json
{
  "content_scripts": [
    {
      "matches": [
        "https://*.yayoi-kk.co.jp/*",
        "https://*.alt.yayoi-kk.co.jp/*"
      ],
      "js": ["src/content/content-script.ts"]
    }
  ]
}
```

## タスクリスト

### Phase 1: 基盤構築
- [ ] Chrome拡張プロジェクトの初期セットアップ
- [ ] TypeScript + Vite + CRXJS の設定
- [ ] Biome（Lint/Format）の設定
- [ ] 基本的なmanifest.json作成

### Phase 2: 変換ロジック移植
- [ ] 型定義（PayrollEntry, AccountingEntry）
- [ ] Shift-JISエンコーディング処理
- [ ] CSV読み書きユーティリティ
- [ ] 変換ロジック本体
- [ ] ユニットテスト

### Phase 3: UI実装
- [ ] ポップアップUI（ファイル選択・変換・ダウンロード）
- [ ] Content Script（弥生NEXTページへのUI注入）
- [ ] エラーハンドリングと通知

### Phase 4: テスト・リリース
- [ ] E2Eテスト
- [ ] Chrome Web Storeへの公開準備
- [ ] ドキュメント整備

## 既存実装との関係

| 実装 | 用途 | 状態 |
|------|------|------|
| `reference/` | プロトタイプ・参照実装 | 完成（維持） |
| `yayoi_next_bridge/` | スタンドアロン版（Python/NiceGUI） | 完成（維持） |
| `chrome-extension/` | Chrome拡張版（TypeScript） | **新規作成** |

スタンドアロン版は「Chrome以外のブラウザユーザー」「オフライン環境」向けとして維持する。

## 参考リンク

- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
- [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin/)
- [encoding.js](https://github.com/nicejmp/encoding.js)
- [弥生会計NEXT インポート仕様](https://support.yayoi-kk.co.jp/subcontents.html?page_id=29611)

## 備考

- 弥生NEXTのDOM構造は変更される可能性があるため、Content Scriptは堅牢に設計する
- Chrome Web Store公開時はプライバシーポリシーが必要
- Manifest V3の制約（Service Worker、リモートコード禁止など）に注意
