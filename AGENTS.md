# 脳リフレクソ (Brain Reflexo) — Agent 向けガイド

泡をはじいて頭をリセットする、商用の癒し系モバイル Web アプリ。  
Vanilla HTML / CSS / JS。バンドラなし。日英 UI。

## 前提

- **第一ターゲットは iPhone Safari**（Files アプリ配信・Web 版の両方）
- 依頼がない限り React / Vite / npm 化しない
- コメントは番号付き日本語セクション見出しの流儀に合わせる
- 体験は「脳疲労リセット」——刺激しすぎない音・光・ペースを守る

## 構成と配信

| ファイル | 役割 |
|---------|------|
| `index.html` + `style.css` + `app.js` | 分割版（PC / Android / 開発） |
| `Brain_Reflexo.html` | **iPhone / オフライン用 1 ファイル版** |
| `build-single-html.js` / `rebuild-single-html.py` / `pack.js` | 単体 HTML・配布物の生成 |
| `server.js` | ローカル確認用 |

- **`app.js` / `style.css` を変えたら、単体 HTML の再生成が必要か確認する**（依頼内容に含めるか、手順を示す）
- プレイヤー向け zip には開発用スクリプトを混ぜない（既存 README の方針）

## 実装ルール

- `app.js` は巨大。該当セクションだけ直し、無関係な整形をしない
- Play / Endless / Meditation のモード差分を壊さない
- Web Audio（消音スイッチ・unlock）、ジャイロ、タッチの既存ガードを維持
- 白銀バブル等のゲームルール定数は、散在させず既存の定義箇所に足す
- やり取りは日本語。確認が必要なものを除き、区切りごとに commit して GitHub へ push する

## やってほしくないこと

- 分割版だけ直して iPhone 用単体 HTML を忘れたまま「完了」にする
- UI の商用トーンを崩す派手な改修
- 依存追加やビルドツールチェーンの刷新（依頼なし）
