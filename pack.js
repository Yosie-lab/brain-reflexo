#!/usr/bin/env node
/**
 * iPhone向け単一HTMLを生成し、配布用 zip を作り直す。
 * 使い方: node pack.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = __dirname;

// 1) 単一HTMLビルド
require('./build-single-html.js');

// 2) 配布用zip（プレイヤーに不要な開発用ファイルは含めない）
const zipName = 'brain_reflexo.zip';
const zipPath = path.join(root, zipName);
const include = [
    '00_iPhone_OPEN_Brain_Reflexo.txt',
    'Brain_Reflexo.html',
    'index.html',
    'style.css',
    'app.js',
    'README.txt'
];

for (const name of include) {
    if (!fs.existsSync(path.join(root, name))) {
        console.error('Missing file:', name);
        process.exit(1);
    }
}

if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
execFileSync('zip', ['-r', zipName, ...include, '-x', '*.DS_Store'], { cwd: root, stdio: 'inherit' });
console.log('Packed', zipName);
