# 弥生給与NEXT → 弥生会計NEXT 仕訳データ変換ツール

弥生給与NEXTから出力した仕訳データを、弥生会計NEXTにインポートできる形式に変換するツールです。

## 📁 フォルダ構成

```
yayoi-next-bridge/
├── reference/          ← このツール
│   ├── convert_payroll_to_accounting.py  （Python版）
│   ├── Convert-PayrollToAccounting.ps1   （PowerShell版）
│   └── README.md
├── journal/             ← 弥生給与NEXTから出力した仕訳データを保存するフォルダ
├── yayoi_next_bridge/   ← 将来のコアロジック実装用フォルダ
└── README.md            ← リポジトリ全体のREADME（ロードマップ等）
```

## 🚀 使い方

### Python版（推奨）

```powershell
# referenceフォルダに移動
cd ".\reference"

# 全フォルダ一括変換（YY-01〜YY-12）
uv run python convert_payroll_to_accounting.py --all

# 単一ファイル変換
uv run python convert_payroll_to_accounting.py "..\YY-01\仕訳データ（〇〇株式会社）_給与支給手続き YYYY_MM_DD 支払い分.txt"
```

### PowerShell版

```powershell
# 全フォルダ一括変換
.\Convert-PayrollToAccounting.ps1 -All

# 単一ファイル変換
.\Convert-PayrollToAccounting.ps1 -InputFile "..\YY-01\仕訳データ（〇〇株式会社）_給与支給手続き YYYY_MM_DD 支払い分.txt"
```

## 📝 変換仕様

### 入力形式（弥生給与NEXT出力）
- **形式**: 14項目CSV（Shift-JIS）
- **識別フラグ**: 0110（開始）、0100（中間）、0101（終了）

### 出力形式（弥生会計NEXT用）
- **形式**: 25項目CSV（Shift-JIS）
- **識別フラグ**: 2110（複数行1行目）、2100（中間行）、2101（最終行）
- **税区分**: 勘定科目がある行は「対象外」、ない行は空白
- **金額**: 勘定科目がない行は「0」（必須項目のため）

### 公式ドキュメント
- [弥生会計NEXT インポートデータの記述形式](https://support.yayoi-kk.co.jp/subcontents.html?page_id=29611)
- [インポートのエラー一覧](https://support.yayoi-kk.co.jp/faq_Subcontents.html?page_id=29668)

## ⚠️ 注意事項

1. **元データは保持される**: 変換後ファイルは `_弥生会計NEXT用.txt` という名前で別ファイルとして出力されます

2. **上書き動作**: 同名の変換後ファイルが存在する場合は上書きされます

3. **会計期間に注意**: 弥生会計NEXT側で設定している会計期間外のデータはインポートできません

4. **文字コード**: 入出力ともにShift-JIS（弥生の標準形式）

## 🔄 毎月の作業フロー

1. **弥生給与NEXTで仕訳データを出力**
   - 給与支給手続き → 仕訳データ出力
   - 該当月のフォルダ（YY-01など、YYは年度プレフィックス）に保存

2. **変換ツールを実行**
   ```powershell
   cd ".\reference"
   uv run python convert_payroll_to_accounting.py --all
   ```

3. **弥生会計NEXTでインポート**
   - 設定 → インポート → 仕訳データ
   - `*_弥生会計NEXT用.txt` ファイルを選択

## 🛠️ トラブルシューティング

### 「借方税込金額は必須項目です」エラー
→ 借方勘定科目がない行でも金額は必須。本ツールは自動で「0」を設定します。

### 「識別フラグが不正です」エラー
→ 正しい識別フラグ（2110/2100/2101）を使用しているか確認。

### 文字化けする
→ ファイルがShift-JISで保存されているか確認。

---
最終更新: 2026年1月26日
