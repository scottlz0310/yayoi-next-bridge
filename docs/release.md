# リリース手順

このドキュメントでは、yayoi-next-bridgeのリリース手順を説明します。

## 概要

リリースは以下の自動化ツールによってサポートされています：

- **バージョン同期スクリプト**: 複数ファイルのバージョンを一括更新
- **リリーススクリプト**: インタラクティブなリリースフロー
- **GitHub Actions**: タグプッシュ時に自動ビルド＆リリース

## バージョン管理対象ファイル

以下の3ファイルでバージョンを管理しています。バージョンバンプ時はすべて同時に更新する必要があります。

| ファイル | フォーマット | 用途 |
|----------|--------------|------|
| `chrome-extension/package.json` | JSON (`"version": "x.x.x"`) | npm パッケージバージョン |
| `chrome-extension/manifest.json` | JSON (`"version": "x.x.x"`) | Chrome拡張バージョン |
| `pyproject.toml` | TOML (`version = "x.x.x"`) | Python パッケージバージョン |

## バージョンバンプ

### コマンド

```bash
# 現在のバージョンを確認
node scripts/bump-version.js

# パッチバージョンをバンプ (例: 0.1.0 → 0.1.1)
node scripts/bump-version.js patch

# マイナーバージョンをバンプ (例: 0.1.0 → 0.2.0)
node scripts/bump-version.js minor

# メジャーバージョンをバンプ (例: 0.1.0 → 1.0.0)
node scripts/bump-version.js major

# 直接バージョンを指定
node scripts/bump-version.js 0.2.0
```

### npm スクリプト（ルートディレクトリ）

```bash
npm run version:check   # 現在のバージョン確認
npm run version:patch   # パッチバンプ
npm run version:minor   # マイナーバンプ
npm run version:major   # メジャーバンプ
```

### 更新されるファイル

```
chrome-extension/package.json   ← "version" フィールド
chrome-extension/manifest.json  ← "version" フィールド
pyproject.toml                  ← version = "..." 行
```

## リリースフロー

### 方法1: インタラクティブリリース（推奨）

```bash
# 現在のバージョンでリリース
node scripts/release.js

# バンプしてからリリース
node scripts/release.js patch
node scripts/release.js minor
node scripts/release.js 0.2.0
```

リリーススクリプトは以下を行います：

1. バージョン整合性チェック
2. バージョンバンプ（引数指定時）
3. CHANGELOG.md の更新確認
4. Git コミット作成
5. Git タグ作成
6. リモートへのプッシュ（確認後）

### 方法2: 手動リリース

```bash
# 1. バージョンをバンプ
node scripts/bump-version.js 0.2.0

# 2. CHANGELOG.md を更新
# [Unreleased] セクションを [0.2.0] - YYYY-MM-DD に変更

# 3. コミット
git add -A
git commit -m "chore: release v0.2.0"

# 4. タグ作成
git tag v0.2.0

# 5. プッシュ
git push
git push --tags
```

## GitHub Actions ワークフロー

`v*` パターンのタグがプッシュされると、`.github/workflows/release.yml` が自動実行されます。

### ワークフロー処理内容

```
1. validate-version (バージョン整合性チェック)
   ├─ タグからバージョンを抽出 (例: v0.2.0 → 0.2.0)
   └─ 3ファイルのバージョンがタグと一致するか検証

2. build-extension (Chrome拡張ビルド)
   ├─ npm ci
   ├─ npm run build
   └─ ZIPパッケージ作成 (yayoi-next-bridge-x.x.x.zip)

3. create-release (GitHubリリース作成)
   ├─ CHANGELOG.md からリリースノートを抽出
   └─ GitHub Release を作成（ZIPファイル添付）
```

### 生成されるアーティファクト

- `yayoi-next-bridge-{version}.zip` - Chrome拡張のZIPパッケージ

## CHANGELOG の書き方

[Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) フォーマットに従います。

```markdown
## [Unreleased]

### 追加
- 新機能の説明

### 変更
- 変更内容の説明

### 修正
- バグ修正の説明
```

リリース時に `[Unreleased]` を `[x.x.x] - YYYY-MM-DD` に変更します。

## バージョニング方針

[Semantic Versioning](https://semver.org/lang/ja/) に従います。

- **MAJOR (x.0.0)**: 破壊的変更（入出力フォーマットの非互換など）
- **MINOR (0.x.0)**: 後方互換性のある機能追加
- **PATCH (0.0.x)**: 後方互換性のあるバグ修正

### プレリリース

プレリリースバージョン（例: `0.2.0-beta.1`）を使用する場合：

```bash
node scripts/bump-version.js 0.2.0-beta.1
```

GitHub Release では自動的に「Pre-release」としてマークされます。

## トラブルシューティング

### バージョン不整合エラー

```
❌ package.json のバージョン (0.1.0) がタグ (0.2.0) と一致しません
```

**原因**: タグを作成する前にバージョンバンプを忘れた

**解決方法**:
```bash
# タグを削除
git tag -d v0.2.0
git push origin :refs/tags/v0.2.0

# バージョンをバンプしてやり直し
node scripts/bump-version.js 0.2.0
git add -A
git commit -m "chore: release v0.2.0"
git tag v0.2.0
git push && git push --tags
```

### リリースワークフローが失敗した

1. GitHub Actions のログを確認
2. バージョン整合性を確認: `node scripts/bump-version.js`
3. 必要に応じてタグを削除して再作成
