#!/usr/bin/env node
/**
 * リリーススクリプト
 *
 * 使用方法:
 *   node scripts/release.js [patch|minor|major|<version>]
 *
 * 処理内容:
 *   1. バージョン整合性チェック
 *   2. バージョンバンプ（指定時）
 *   3. CHANGELOG.md の確認
 *   4. コミット & タグ作成
 *   5. プッシュ
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

/**
 * コマンドを実行
 */
function exec(cmd, options = {}) {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: "inherit", ...options });
}

/**
 * コマンドを実行して出力を取得
 */
function execQuiet(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
}

/**
 * 現在のバージョンを取得
 */
function getCurrentVersion() {
  const pkgPath = join(ROOT, "chrome-extension/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  return pkg.version;
}

/**
 * バージョン整合性チェック
 */
function checkVersionConsistency() {
  const version = getCurrentVersion();

  const files = [
    { path: "chrome-extension/package.json", getter: (c) => JSON.parse(c).version },
    { path: "chrome-extension/manifest.json", getter: (c) => JSON.parse(c).version },
    { path: "pyproject.toml", getter: (c) => c.match(/^version\s*=\s*"([^"]+)"/m)?.[1] },
  ];

  let allMatch = true;
  console.log("\n📋 バージョン整合性チェック:");

  for (const file of files) {
    const content = readFileSync(join(ROOT, file.path), "utf-8");
    const fileVersion = file.getter(content);
    const match = fileVersion === version;
    console.log(`  ${match ? "✅" : "❌"} ${file.path}: ${fileVersion}`);
    if (!match) allMatch = false;
  }

  return allMatch;
}

/**
 * Git状態チェック
 */
function checkGitStatus() {
  const status = execQuiet("git status --porcelain");
  return status === "";
}

/**
 * ユーザーに確認
 */
async function confirm(message) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

/**
 * CHANGELOG.mdのUnreleasedセクションをバージョン付きに変更
 */
function updateChangelog(version) {
  const changelogPath = join(ROOT, "CHANGELOG.md");
  let content = readFileSync(changelogPath, "utf-8");

  const today = new Date().toISOString().split("T")[0];
  content = content.replace(
    /## \[Unreleased\]/,
    `## [Unreleased]\n\n## [${version}] - ${today}`
  );

  writeFileSync(changelogPath, content, "utf-8");
  console.log(`✅ CHANGELOG.md を更新しました`);
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);
  let version = getCurrentVersion();

  console.log("🚀 リリース準備を開始します\n");

  // バージョン整合性チェック
  if (!checkVersionConsistency()) {
    console.error("\n❌ バージョンが一致していません。先に bump-version.js を実行してください。");
    process.exit(1);
  }

  // バージョンバンプが指定されている場合
  if (args.length > 0) {
    console.log("\n📦 バージョンをバンプします...");
    exec(`node scripts/bump-version.js ${args[0]}`);
    version = getCurrentVersion();
  }

  console.log(`\n🏷️  リリースバージョン: v${version}`);

  // Git状態チェック
  const isClean = checkGitStatus();
  if (!isClean) {
    console.log("\n⚠️  未コミットの変更があります:");
    exec("git status --short", { stdio: "pipe" });
  }

  // 確認
  if (!(await confirm("\nこのバージョンでリリースしますか？"))) {
    console.log("キャンセルしました");
    process.exit(0);
  }

  // CHANGELOGを更新するか確認
  if (await confirm("CHANGELOG.mdのUnreleasedセクションをバージョン付きに変更しますか？")) {
    updateChangelog(version);
  }

  // コミット
  console.log("\n📝 変更をコミットします...");
  exec("git add -A");
  exec(`git commit -m "chore: release v${version}" --allow-empty`);

  // タグ作成
  console.log("\n🏷️  タグを作成します...");
  exec(`git tag v${version}`);

  // プッシュ確認
  if (await confirm("\nリモートにプッシュしますか？")) {
    exec("git push");
    exec("git push --tags");
    console.log("\n🎉 リリース完了！GitHub Actionsがビルドを開始します。");
    console.log(`   https://github.com/scottlz0310/yayoi-next-bridge/releases`);
  } else {
    console.log("\n📋 プッシュはスキップしました。手動で実行してください:");
    console.log("   git push && git push --tags");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
