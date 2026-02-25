#!/usr/bin/env node
/**
 * バージョン同期スクリプト
 *
 * 使用方法:
 *   node scripts/bump-version.js <new-version>
 *   node scripts/bump-version.js patch|minor|major
 *
 * 例:
 *   node scripts/bump-version.js 0.2.0
 *   node scripts/bump-version.js patch  # 0.1.0 -> 0.1.1
 *   node scripts/bump-version.js minor  # 0.1.0 -> 0.2.0
 *   node scripts/bump-version.js major  # 0.1.0 -> 1.0.0
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// バージョンを管理するファイル
const VERSION_FILES = [
  {
    path: "chrome-extension/package.json",
    type: "json",
    key: "version",
  },
  {
    path: "chrome-extension/manifest.json",
    type: "json",
    key: "version",
  },
];

/**
 * 現在のバージョンを取得
 */
function getCurrentVersion() {
  const pkgPath = join(ROOT, "chrome-extension/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  return pkg.version;
}

/**
 * セマンティックバージョンをパース
 */
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`無効なバージョン形式: ${version}`);
  }
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

/**
 * バージョンをバンプ
 */
function bumpVersion(current, type) {
  const v = parseVersion(current);
  switch (type) {
    case "major":
      return `${v.major + 1}.0.0`;
    case "minor":
      return `${v.major}.${v.minor + 1}.0`;
    case "patch":
      return `${v.major}.${v.minor}.${v.patch + 1}`;
    default:
      // 直接バージョン指定の場合はそのまま返す
      parseVersion(type); // バリデーション
      return type;
  }
}

/**
 * JSONファイルのバージョンを更新
 */
function updateJsonVersion(filePath, key, newVersion) {
  const fullPath = join(ROOT, filePath);
  const content = JSON.parse(readFileSync(fullPath, "utf-8"));
  const oldVersion = content[key];
  content[key] = newVersion;
  writeFileSync(fullPath, `${JSON.stringify(content, null, 2)}\n`, "utf-8");
  return oldVersion;
}

/**
 * メイン処理
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("現在のバージョン:", getCurrentVersion());
    console.log("\n使用方法:");
    console.log("  node scripts/bump-version.js <new-version>");
    console.log("  node scripts/bump-version.js patch|minor|major");
    process.exit(0);
  }

  const input = args[0];
  const currentVersion = getCurrentVersion();
  const newVersion = bumpVersion(currentVersion, input);

  console.log(`バージョン更新: ${currentVersion} → ${newVersion}\n`);

  for (const file of VERSION_FILES) {
    try {
      if (file.type === "json") {
        updateJsonVersion(file.path, file.key, newVersion);
      }
      console.log(`✅ ${file.path}`);
    } catch (error) {
      console.error(`❌ ${file.path}: ${error.message}`);
      process.exit(1);
    }
  }

  console.log(`\n🎉 バージョン ${newVersion} に更新しました`);
  console.log("\n次のステップ:");
  console.log("  1. CHANGELOG.md を更新");
  console.log("  2. git add -A && git commit -m 'chore: release v" + newVersion + "'");
  console.log("  3. git tag v" + newVersion);
  console.log("  4. git push && git push --tags");
}

main();
