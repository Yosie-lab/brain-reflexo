#!/usr/bin/env node
/**
 * GitHub Pages 用に docs/ を同期する。
 * - docs/index.html … 公開ランディング（本体なし）
 * - docs/p/<ACCESS_PATH>/ … 購入者限定 PWA 本体
 *
 * 使い方:
 *   1. cp access.env.example access.env  # ACCESS_PATH を設定
 *   2. node scripts/sync-pages.js
 *   3. GitHub Pages の Source を「docs/」フォルダに設定
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const docsDir = path.join(root, 'docs');

function loadEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const out = {};
    fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach((line) => {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) return;
        out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    });
    return out;
}

function rmrf(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) rmrf(p);
        else fs.unlinkSync(p);
    }
    fs.rmdirSync(dir);
}

function copyFile(src, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
        const s = path.join(src, name);
        const d = path.join(dest, name);
        if (fs.statSync(s).isDirectory()) copyDir(s, d);
        else copyFile(s, d);
    }
}

const env = {
    ...loadEnv(path.join(root, 'access.env.example')),
    ...loadEnv(path.join(root, 'access.env'))
};

const accessPath = (env.ACCESS_PATH || '').trim();
const siteBase = (env.SITE_BASE || 'https://yosie-lab.github.io/brain-reflexo').replace(/\/$/, '');

if (!accessPath || accessPath === 'REPLACE_WITH_RANDOM_HEX' || !/^[A-Za-z0-9_-]+$/.test(accessPath)) {
    console.error('Invalid ACCESS_PATH. Set a random hex in access.env (see access.env.example).');
    process.exit(1);
}

const playUrl = `${siteBase}/p/${accessPath}/`;
const destApp = path.join(docsDir, 'p', accessPath);

// Clean previous secret app dirs under docs/p (keep landing)
const pRoot = path.join(docsDir, 'p');
if (fs.existsSync(pRoot)) {
    for (const name of fs.readdirSync(pRoot)) {
        rmrf(path.join(pRoot, name));
    }
}

fs.mkdirSync(destApp, { recursive: true });

const appFiles = [
    'index.html',
    'app.js',
    'style.css',
    'manifest.webmanifest',
    'sw.js'
];
for (const f of appFiles) {
    copyFile(path.join(root, f), path.join(destApp, f));
}
copyDir(path.join(root, 'icons'), path.join(destApp, 'icons'));

// Landing page (no game)
const landing = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>脳リフレクソ / Brain Reflexo</title>
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="#0b1528">
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100dvh; display: grid; place-items: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: radial-gradient(circle at 50% 30%, #0b1528 0%, #050811 60%, #010205 100%);
      color: #e2e8f0; padding: 24px; text-align: center;
    }
    main {
      max-width: 420px; width: 100%;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 18px; padding: 28px 22px;
    }
    h1 { font-size: 22px; margin: 0 0 8px; letter-spacing: 0.04em; }
    .en { font-size: 12px; color: #94a3b8; margin-bottom: 18px; }
    p { font-size: 13px; line-height: 1.65; color: #cbd5e1; margin: 0 0 12px; }
    .note { font-size: 11px; color: #64748b; margin-top: 16px; }
  </style>
</head>
<body>
  <main>
    <h1>脳リフレクソ</h1>
    <div class="en">Brain Reflexo</div>
    <p>本ページは案内用です。プレイ用の本体は、<strong>ご購入後にお渡しする限定URL</strong>から起動してください。</p>
    <p>限定URLを開くと、解凍なしですぐ遊べます。Safari の「ホーム画面に追加」でアプリのように使えます。</p>
    <p class="note">URLの転載・再配布は禁止です。完全な複製防止機能ではありません。</p>
  </main>
</body>
</html>
`;

fs.writeFileSync(path.join(docsDir, 'index.html'), landing, 'utf8');
fs.writeFileSync(path.join(docsDir, '.nojekyll'), '', 'utf8');

// Helper for the seller (gitignored local file — not published)
const sellerNote = `# Purchaser URL (local reminder — do not paste into public issues/commits)

${playUrl}

GitHub Pages: set Source to "Deploy from a branch" → /docs folder.
`;
fs.writeFileSync(path.join(root, '.seller-url.local.txt'), sellerNote, 'utf8');

console.log('Synced Pages app to docs/p/<ACCESS_PATH>/');
console.log('Landing: docs/index.html');
console.log('Purchaser URL written to .seller-url.local.txt (gitignored).');
