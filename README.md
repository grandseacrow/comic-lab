# comic.lab — Balloon Editor v0.1

完成済みの漫画画像へ、SVG吹き出しと編集できる日本語セリフを重ねるクライアントサイドアプリです。
Vector-Labとは独立したプロジェクトです。

## 起動と検証

Node.js 24推奨。

```sh
npm ci
npm run dev
npm test
npm run build
```

`dist/` をCloudflare Pagesなどの静的ホスティングへ配置できます。サーバーAPI・認証・外部DBはありません。

## 使い方

1. PNG・JPEG・WebPを読み込むか「サンプルで試す」を選びます。
2. 楕円または角丸四角の吹き出しを追加します。
3. 本体をドラッグして移動し、右下の四角いハンドルでサイズを変更します。
4. しっぽのPを先端、A・Bを付け根としてドラッグします。表示切替・左右／上下反転もできます。
5. 右のプロパティでセリフ、縦横方向、フォント、太字、色、行間、字間、余白を編集します。
6. 「プロジェクト保存」で元画像と編集可能なJSONをZIP保存します。「プロジェクトを開く」で復元できます。
7. 「PNG書き出し」で元画像と同じピクセル寸法の完成原稿を保存します。

レイヤー一覧の上ほど手前です。選択後の矢印で順序変更、複製、削除ができます。
スマートフォンでは上部のツール／プロパティからパネルを開きます。

- パン：移動ツール、またはSpace＋ドラッグ
- 拡大縮小：下部の＋／−、またはCtrl / ⌘＋ホイール
- 取り消し：Ctrl / ⌘ Z
- やり直し：Ctrl / ⌘ Shift Z、Ctrl / ⌘ Y
- 複製：Ctrl / ⌘ D
- 削除：Delete / Backspace
- ZIP保存：Ctrl / ⌘ S

入力欄にフォーカス中はアプリのショートカットを実行しません。自動保存はありません。
PNG書き出しでは編集可能なプロジェクトは保存されないため、再編集する場合はZIPも保存してください。

## データ・描画方式

- 原稿座標は元画像のピクセル単位。表示倍率から分離しています。
- 背景の元バイト列は変更せずZIPへ格納します。
- 吹き出し本体としっぽはPaper.jsの和集合による単一パスで描画します。
- フォントはSIL Open Font LicenseのNoto Sans JP / Noto Serif JPを同梱しています。
- 日本語の縦書きはOpenTypeのvert / vrt2置換で縦書き字形を取得します。英数字の連続部分だけを横倒しにし、日本語全体は回転しません。
- 文字はfontkitでSVG輪郭へ変換します。編集画面とPNG合成で同じ形状・配置データを使い、出力時のWebフォント参照を不要にしています。
- 単純な禁則処理、自動折り返し、手動改行、はみ出し警告を備えます。縦中横やルビは対象外です。
- フォントにない文字を検出するとPNG出力を停止し、修正を案内します。

保存形式は `project.json` と `assets/background.png` / `.jpg` / `.webp` を含むZIPです。
JSON形式バージョンは1です。選択状態・倍率・編集ハンドル・履歴は保存しません。

画像は50MB・2,000万画素・一辺20,000px以下、吹き出し200個まで。
ZIPは50MB、展開後100MB、内部ファイル10件以下に制限します。
不明なファイルパス、重複エントリ、不正な型・数値・色・参照は拒否します。
復元準備が完了してから現在の原稿を入れ替えるため、読込失敗時は原稿を保持します。

## 自動検証と未確認事項

`npm test` は、5個の独立した吹き出し、しっぽ接合、縦書き字形、太字、文字はみ出し、ZIP往復、元画像バイト列保持、不正データ拒否、原寸SVG出力を検証します。
`npm run build` はTypeScript検査と本番ビルドを行います。

この実装環境ではSites用ブラウザ操作ツールが提供されていないため、実ブラウザでのマウス／タッチ操作、IME、ダウンロード、Canvasによる最終PNG生成、Safari実機での表示一致は未検証です。自動テストだけで仕様書の全合格基準を確認済みとはしていません。
手動受入手順は `docs/acceptance.md` にあります。

## Cloudflare Pages

`.github/workflows/ci.yml` はpush / Pull Request時にテストとビルドを実行します。
`.github/workflows/deploy.yml` はmainの変更時および手動実行に対応します。
初回はCloudflare PagesにDirect Uploadプロジェクト `comic-lab`（production branch: main）を作成し、このリポジトリのActions Secretsへ以下を登録してください。

- `CLOUDFLARE_API_TOKEN`：対象アカウントのCloudflare Pages Edit権限
- `CLOUDFLARE_ACCOUNT_ID`：対象アカウントのAccount ID

Secrets未登録時はデプロイをスキップします。Vector-Labのプロジェクト・Secrets・ワークフローは変更しません。
Pages側のGit連携を使う場合は `npm ci && npm run build`、出力先 `dist` を指定し、Actionsからのデプロイと二重実行しない構成にしてください。

Sites側のWeb版は `.openai/hosting.json` のプロジェクトに独立して配置します。
GitHubへのpushだけでSites版が更新される構成ではありません。
