# 変更履歴

本プロジェクトの主な変更点を記録します。  
フォーマットは [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠しています。

## [Unreleased]

### 追加

#### CI/CD・品質管理
- CI/CDパイプライン（GitHub Actions）の設定
- Codecovによるカバレッジレポート
- エンコーディング処理のユニットテスト（9件追加、計28件）

#### Chrome拡張（chrome-extension/）
- **Side Panel UI**: 弥生会計NEXTと並行して使えるサイドパネル
- **ドラッグ&ドロップ**: ファイル選択をD&Dで簡単に
- **変換ロジック**: 弥生給与NEXT（14項目）→ 弥生会計NEXT（25項目）の変換
- **Content Script**: インポート画面に「給与データを変換」ボタンを自動挿入
- **SPA対応**: MutationObserverによるURL監視で画面遷移に追従
- **Shift-JIS対応**: encoding-japaneseライブラリによる文字コード変換
- **入力バリデーション**: 不正なCSVフォーマットの検出とエラー表示
- **自動ダウンロード**: 変換完了後に `*_弥生会計NEXT用.txt` を自動保存

#### Python参考実装（reference/）
- `convert_payroll_to_accounting.py`: CLIベースの変換スクリプト
- `Convert-PayrollToAccounting.ps1`: PowerShell版変換スクリプト
- 一括変換モード（`--all`オプション）

#### Python版コア（yayoi_next_bridge/）
- `core/converter.py`: 変換ロジックの初期実装
- `gui/app.py`: NiceGUIベースのGUI（プロトタイプ）

#### ドキュメント
- README.md: プロジェクト概要、クイックスタート、技術スタック
- AGENTS.md: AI開発ガイドライン
- Chrome拡張実装計画（docs/chrome-extension-plan.md）
- セキュリティ・プライバシーポリシー（chrome-extension/PRIVACY.md）

#### テスト
- 変換ロジックのユニットテスト（19件）
- エンコーディング処理のユニットテスト（9件）

#### 技術スタック
- TypeScript（strict mode）
- Vite + CRXJS（Chrome拡張ビルド）
- Biome（Lint/Format）
- Vitest（ユニットテスト）
- Manifest V3 + Side Panel API

### セキュリティ
- host_permissionsを `next-kaikei.yayoi-kk.co.jp` のみに制限
- 外部通信なし（完全オフライン処理）
- 認証情報・Cookieへのアクセスなし

---

## バージョニング方針

- **MAJOR**: 破壊的変更（入出力フォーマットの非互換など）
- **MINOR**: 機能追加（新しい変換オプション、UIの追加など）
- **PATCH**: バグ修正、ドキュメント更新
