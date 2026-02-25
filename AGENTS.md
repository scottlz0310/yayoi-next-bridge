# リポジトリガイドライン

## AI応答・ドキュメント言語

- **AIは日本語で応答すること**：コード生成時のコメント、ドキュメント生成、会話応答はすべて日本語で行うこと。
- コード内のコメント、README、設計書などのドキュメントも日本語で記述すること。
- 変数名・関数名などの識別子は英語を使用すること。

## 技術スタック方針

- メイン実装は `chrome-extension/`（TypeScript）を採用する。
- 補助実装として `tampermonkey/`（JavaScript）を維持する。
- 旧パイロット版の Python/NiceGUI 実装は削除済みであり、新規実装対象に含めない。

## Lint・型チェック・品質基準

- TypeScript は `strict: true` を維持し、型安全性を崩さないこと。
- Lint/Format は `biome` を使用し、CI でのチェックを必須とすること。
- CI/CD のゲート（typecheck / lint / test / build）を通過しない変更はマージしないこと。

## テスト必須方針

- **すべての機能実装にはテストを必ず書くこと**。テストなしのコードはマージ不可。
- 新規・変更コードのカバレッジは 80% 以上を目標とすること。
- ユニットテストは必須。主要フローは統合/E2Eも検討すること。

## プロジェクト構造とモジュール構成

- `chrome-extension/` は本体（UI、変換ロジック、テスト）を格納する。
- `tampermonkey/` は軽量配布向けユーザースクリプトを格納する。
- `docs/` は運用・設計ドキュメント、`scripts/` はリリース補助スクリプトを格納する。

## ビルド、テスト、開発コマンド

- `cd chrome-extension`
- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm run test:coverage -- --run`
- `npm run build`
- `node scripts/bump-version.js patch|minor|major|<version>`
- `node scripts/release.js [patch|minor|major|<version>]`

## コーディングスタイルと命名規則

- TypeScript: 2スペースインデント、関数名は `camelCase`、型名は `PascalCase`。
- 明示的な型付けを優先し、`any` の使用は避けること。
- ボタン要素には `type` 属性を必ず明示すること。

## テストガイドライン

- テストファイルは `chrome-extension/tests/` に配置し、`*.test.ts` 命名規則に従うこと。
- モック・スタブを適切に活用し、外部依存を分離したテストを書くこと。

## コミットとプルリクエストのガイドライン

- Git履歴は簡潔な命令形の英語主語（例: `Enhance README ...`）で記述すること。
- PRには変更概要、確認手順、必要に応じてUI差分や入出力例を含めること。

## セキュリティとデータ取り扱い

- 実際の給与データをコミットしないこと。共有サンプルは個人識別情報を削除すること。
