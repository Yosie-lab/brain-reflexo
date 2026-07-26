# GitHub Pages デプロイ手順（脳リフレクソ）

## 公開構成

- `docs/index.html` … 公開ランディング（本体なし）
- `docs/p/<ACCESS_PATH>/` … 購入者限定 PWA 本体

## 手順

1. `cp access.env.example access.env`
2. `ACCESS_PATH` にランダム文字列を設定（例: `openssl rand -hex 16`）
3. `node scripts/sync-pages.js`
4. `.seller-url.local.txt` に出た URL を `sales/purchaser-guide.txt`（または PDF）へ転記
5. 変更を push
6. GitHub リポジトリ → **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: 公開に使うブランチ（例 `main` または本 feature ブランチを一時公開）
   - Folder: **/docs**
7. 数分後、ランディングと限定URLが有効になる

購入者案内の原稿: `sales/purchaser-guide.md` / `sales/purchaser-guide.txt`

## 注意

- `access.env` と `.seller-url.local.txt` は gitignore 済み
- 公開リポジトリではパス推測の難易度による限定であり、完全なDRMではない
- アプリ本体を更新したら、必ず `node scripts/sync-pages.js` を再実行してから push
