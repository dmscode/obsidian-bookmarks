/**
 * 版本号更新脚本
 * 功能：自动更新 Obsidian 插件的版本号信息
 * 
 * 主要功能：
 * 1. 从环境变量获取目标版本号（npm_package_version）
 * 2. 读取并更新 manifest.json 文件中的版本号
 * 3. 同步更新 versions.json 文件中的版本映射关系
 * 
 * 执行时机：通常在 npm 发布流程中自动调用
 */
import { readFileSync, writeFileSync } from "fs";

// 从 npm 环境变量中获取目标版本号（由 npm 在发布时自动设置）
const targetVersion = process.env.npm_package_version;

// 读取并更新 manifest.json 文件
// 从 manifest.json 中读取 minAppVersion（最低支持的 Obsidian 版本）
// 将版本号更新为目标版本号
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

// 更新 versions.json 文件
// 将目标版本号和 minAppVersion 添加到版本映射中
// 只有当 minAppVersion 不存在于 versions.json 中时才添加（避免重复）
const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
if (!Object.values(versions).includes(minAppVersion)) {
    versions[targetVersion] = minAppVersion;
    writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));
}