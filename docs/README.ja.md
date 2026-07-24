# setupper（日本語）

> 自分用のよく使うセットアップや開発起動のショートカットを、すべて 1 つの
> `~/.zshrc` に溜め込むのではなく、ワークスペースごとの単一 YAML に定義して実行す
> るための CLI。

**言語:** [English](../README.md) · 日本語（このファイル）

## 課題

普段よく使うコマンドは、シェルの関数や alias に短縮して `~/.zshrc` に保存しがち
です。

```sh
alias <name>='<command> && <command> && …'
<name>() { cd <repo>; <command>; <command>; … }
```

しかし 1 つの `~/.zshrc` に溜め込むと、1 台のマシンに複数ワークスペース分の
ショートカットが乱立してしまい、名前は衝突し、どのコマンドがどのプロジェクトの
ものか分かりにくくなります。**setupper** はワークスペースごとに `setupper.yaml`
を持たせ、コマンドをグローバルなシェル設定ではなくワークスペース側に置くことで、
`~/.zshrc` をすっきり保ちます。

## インストール

単一の実行バイナリとして配布します。ビルドして `PATH` の通った場所に置けば、
どのワークスペースからでも `setupper` として実行できます。

```sh
bun install
bun build --compile --outfile ~/bin/setupper src/index.ts
```

### 補足: 短いエイリアス

`setupper` は毎回打つには少し長いので、短いエイリアスを登録しておくと便利です。
シェルの設定ファイル（`~/.zshrc`、`~/.bashrc` など）に追記します。

```sh
alias sup='setupper'   # おすすめ — 短くて覚えやすく、"setUPPer" の一部
```

`sup` が既に使われている場合の候補:

| エイリアス | 理由 |
| --- | --- |
| `sup` | **おすすめ。** 3 文字で "set**UP**per" を連想でき、覚えやすい。 |
| `stp` | "setup" の子音。 |
| `spr` | "setupper" の頭文字。 |
| `se` | 最短（2 文字）だが、打ち間違い・衝突のリスクが高め。 |

既に使っているコマンドと衝突しない名前を選んでください（`command -v <name>`
で確認できます）。

## 使い方

```sh
setupper                 # 利用可能なコマンド一覧（`setupper list` と同じ）
setupper <command>       # コマンドを実行
setupper <command> -h    # コマンドの説明とステップを表示
setupper --version
```

`setupper` はカレントディレクトリから上方向へたどって最も近い `setupper.yaml` を
探すため、ワークスペース内のどのリポジトリからでも実行できます。

## セキュリティ

`setupper` は `setupper.yaml` のシェルステップを、実行ユーザーの権限そのままで
実行します。サンドボックスではなく、あくまでコマンドランナーです。つまり
`setupper.yaml` は、あなたのアカウントで実行できる *任意の* コマンドを実行できて
しまいます。

**信頼できない `setupper.yaml` は実行しないでください。** 他人由来のもの
（クローンしてきたリポジトリ、共有ワークスペース、ダウンロードしたサンプルなど）
は、その提供元のシェルスクリプトと同じように扱い、実行する前に必ず中身を確認して
ください。また `setupper` は最も近い `setupper.yaml` を求めてディレクトリを上方向
へたどるため、実際に読み込まれるファイルが意図したものか（上位ディレクトリに紛れ
込んだものではないか）も確認してください。

## 用語

- **ワークスペース (Workspace)** — 複数のリポジトリをまとめるディレクトリ。
  単一の `setupper.yaml` を置く場所。
- **コマンド (Command)** — 説明とステップ列を持つ名前付きショートカット。
- **ステップ (Step)** — 1 行のシェルコマンド。上から順に実行され、途中で失敗した
  ステップがあれば、そこで残りを実行せずコマンドを打ち切る。
- **作業ディレクトリ (`dir`)** — コマンドを実行する場所。ワークスペースルート
  からの相対パス。通常はリポジトリのサブディレクトリ。

## 設定 — `setupper.yaml`

ワークスペースルートに 1 つだけ置きます。

```yaml
version: 1

# すべてのコマンドに渡す環境変数。${VAR} は環境から展開される。
env:
  SHARED_TOOLS_DIR: ${HOME}/tools

commands:
  # 最小形: 名前 + シェルステップの列。
  web:
    description: 依存インストール、.env.local 生成、web アプリ起動
    dir: web-app                   # ワークスペースルートからの相対パス
    run:
      - npm install
      - cp -n .env.sample .env.local      # -n は既存の .env.local を残す
      - npm run dev

  # ステップは最初の失敗で中断する。dir と env はコマンドごとに指定できる。
  api:
    description: API 開発サーバーのブートストラップと起動
    dir: api-server
    run:
      - pnpm install
      - cp -n .env.sample .env.local
      - pnpm migrate
      - pnpm dev

  # ステップは単なるシェルなので任意のツールが使える。
  up:
    description: インストール、env ファイル生成、開発サーバー起動
    dir: web-app
    run:
      - bun install
      - bunx lefthook install
      - cp -n .env.sample .env.local
      - echo "API は別ターミナルで 'setupper api' を実行"
      - bun run dev
```

### スキーマ

| キー | 位置 | YAML 型 | 意味 |
| --- | --- | --- | --- |
| `version` | ルート | number | 設定スキーマのバージョン。当面は `1`。 |
| `env` | ルート | map | すべてのコマンドに渡す環境変数。`${VAR}` 展開に対応。 |
| `commands` | ルート | map | 名前 → コマンド定義。 |
| `description` | コマンド | string | `setupper list` に表示される 1 行説明。 |
| `dir` | コマンド | string | 作業ディレクトリ（ワークスペースルートからの相対）。既定はワークスペースルート。 |
| `env` | コマンド | map | 追加の環境変数。ルートの `env` に上書きマージされる。 |
| `run` | コマンド | string または list | シェルステップ。システムシェルで上から順に実行し、最初に失敗したステップで中断する。 |
| `run` | ステップ | string | マップ形式のステップで実行するコマンド。 |
| `allow_failure` | ステップ | boolean | `true` なら、このステップが失敗しても中断せず次へ進む。既定は `false`。 |

ステップをマップ形式で書くと、より細かく制御できます。

```yaml
run:
  - pnpm install
  - run: cp -n .env.sample .env.local
    allow_failure: true            # このステップが失敗しても続行する
```

## setupper が置き換えるもの（シェル alias との対応）

| シェルのパターン | setupper での表現 |
| --- | --- |
| `alias <name>='… && … && …'` | `commands.<name>.run` のリスト |
| `cd $(git rev-parse --show-toplevel)` | `dir:`（ワークスペースからの相対） |
| <code>cp -n .env.sample .env.local &#124;&#124; true</code> | `cp -n` ステップ / `allow_failure: true` |
| `export SOME_VAR=…` | トップレベルの `env:` |
| `echo "hint…"` | `echo` ステップ |

## ドキュメント

- English: ルートの [`README.md`](../README.md)
- 日本語: この `docs/README.ja.md`
