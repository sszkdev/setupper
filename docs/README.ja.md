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

### 補足: `setupper` を付けずにコマンドを実行する

短いエイリアスを使っても、まだプレフィックス（`sup web`）は必要です。コマンドを
素の名前（`web`）で実行したい場合は、setupper のシェル統合を追加します。

```sh
# ~/.zshrc
eval "$(setupper shell-init zsh)"

# ~/.bashrc
eval "$(setupper shell-init bash)"
```

これは `command_not_found_handler`（zsh）/ `command_not_found_handle`（bash）を
登録します。実在しないコマンド名を打つと、setupper が最も近い `setupper.yaml` を
調べ、そこに定義があれば実行します。setupper はカレントディレクトリから上方向へ
たどって設定を解決するため、同じ素の名前が「今いるワークスペース」のコマンドに
対応します。ワークスペースごとのシェル設定は不要です。

注意点:

- 発火するのは**実在コマンドでない**名前のときだけです。`PATH` 上に `web` という
  プログラムがあればそちらが優先されます。衝突しない名前を選んでください
  （`command -v <name>` で確認できます）。
- 未定義名の単なる打ち間違いは通常の「command not found」に落ちるので、意図しない
  コマンドが走ることはありません。

## 使い方

```sh
setupper                    # 利用可能なコマンド一覧（`setupper list` と同じ）
setupper <command> [args]   # コマンドを実行（args は `args` を宣言したコマンドのみ）
setupper <command> -h       # コマンドの説明・使い方・ステップを表示
setupper --version
```

`setupper` はカレントディレクトリから上方向へたどって最も近い設定ファイル
（`setupper.yaml`、または `setupper.yml`）を探すため、ワークスペース内のどの
リポジトリからでも実行できます。

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
- **ステップ (Step)** — シェルのスニペット。上から順に実行され、途中で失敗した
  ステップがあれば、そこで残りを実行せずコマンドを打ち切る。既定では Bun 内蔵
  シェルで実行され、`shell` を指定すると外部シェルで実行される
  （[シェルの選択](#シェルの選択)を参照）。
- **作業ディレクトリ (`dir`)** — コマンドを実行する場所。ワークスペースルート
  からの相対パス。通常はリポジトリのサブディレクトリ。

## 設定 — `setupper.yaml`

ワークスペースルートに 1 つだけ置きます。ファイル名は `setupper.yaml` でも
`setupper.yml` でも構いません（両方ある場合は `.yaml` が優先されます）。

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
| `shell` | コマンド | string | このコマンドのステップを実行するシェル（例: `zsh`、`bash`）。各ステップは `<shell> -c <step>` として実行される。既定は Bun 内蔵シェル。 |
| `run` | コマンド | string または list | シェルステップ。上から順に実行し、最初に失敗したステップで中断する。 |
| `run` | ステップ | string | マップ形式のステップで実行するコマンド。 |
| `allow_failure` | ステップ | boolean | `true` なら、このステップが失敗しても中断せず次へ進む。既定は `false`。 |
| `shell` | ステップ | string | このステップだけのシェル。コマンドの `shell` を上書きする。 |
| `args` | コマンド | list | コマンドが受け付ける位置引数（[引数の受け渡し](#引数の受け渡し)を参照）。既定はなしで、余分な引数はエラーになる。 |
| `name` | 引数 | string | 引数名。`^[a-z][a-z0-9_]*$` に一致する必要がある。ステップには `SETUPPER_ARG_<NAME>` として渡される。 |
| `description` | 引数 | string | `setupper <command> -h` に表示される説明。 |
| `default` | 引数 | string | 引数を省略したときに使う値。指定しない引数は必須になる。 |
| `rest` | 引数 | boolean | 残りの引数をすべて受け取る。最後の引数にのみ指定でき、`shell` が必要。既定は `false`。 |

ステップをマップ形式で書くと、より細かく制御できます。

```yaml
run:
  - pnpm install
  - run: cp -n .env.sample .env.local
    allow_failure: true            # このステップが失敗しても続行する
```

### シェルの選択

既定では各ステップは Bun 内蔵シェルで実行されます。高速でポータブルなうえ、よくある
用途（パイプ、`&&`/`||`、リダイレクト、`$(…)`、`${VAR}`）はカバーしますが、**完全な
シェルではありません**。`for` ループ・バックグラウンド起動（`&`）・`trap` などは
サポートされません。

`shell` を指定すると、そのコマンドのステップを実シェルで実行できます。ステップは
`<shell> -c <step>` として実行されるため、複数行の `run:` ブロックと組み合わせれば
そのシェルの言語機能（ループ、バックグラウンド起動、`trap` など）をフルに使えます。
本格的な制御構文が必要なとき、あるいは既存のシェル関数をほぼそのまま移植したいときに
便利です。

```yaml
commands:
  e2e:
    description: モックサーバーを起動して待ち受け、e2e テストを実行する
    dir: app
    shell: bash                    # 下のブロックを bash で実行
    run: |
      npm run mock-server &                     # バックグラウンド起動
      server=$!
      trap 'kill "$server" 2>/dev/null' EXIT    # 終了時に後始末する
      for i in $(seq 1 10); do                  # 起動を待つ
        curl -sf http://localhost:3000/health && break
        sleep 1
      done
      npm run test:e2e
```

`shell` はステップ単位（マップ形式のステップ）でも指定でき、そのステップだけ
コマンドの `shell` を上書きできます。

### 引数の受け渡し

コマンドは `args` で宣言した場合にだけ位置引数を受け付けます。宣言していない
コマンドに余分な引数や `--dry-run` のような未知のフラグを渡すと、黙って無視せず
エラーになります。

```yaml
commands:
  logs:
    description: サービスのログを追う
    args:
      - name: service
        description: サービス名（例: api、web）
      - name: lines
        default: "100"
    run: docker compose logs --tail "$SETUPPER_ARG_LINES" "$SETUPPER_ARG_SERVICE"
```

`setupper logs api` は 100 行、`setupper logs api 20` は 20 行を表示します。

- 各引数は `SETUPPER_ARG_<NAME>`（name を大文字にしたもの）という環境変数として、
  Bun 内蔵シェルでも外部シェル（`shell`）でも渡されます。値はデータとして渡され、
  シェルとして再解釈されることはないため、`setupper logs '; rm -rf ~'` は単に変わった
  サービス名として扱われます。
- `default` のない引数は必須で、足りないと使い方を表示して終了コード 1 で終了します。
  必須の引数は省略可能な引数より前に置きます。宣言より多い引数もエラーです。
- `-` で始まる引数はフラグとみなされ、エラーになります。`-` で始まる値は `--` の
  後ろに置いてください（`setupper logs -- -weird-name`）。`-h` / `--help` を単独で
  渡すとヘルプを表示し、`setupper logs -- -h` なら `-h` を引数として渡します。
- `shell` を指定した場合は、位置パラメータ `$1`、`$2`、…、`"$@"` としても受け取れます
  （宣言順で、省略した引数には default が入ります）。Bun 内蔵シェルでは `$1` は
  コマンドの引数を**指さない**ので、`SETUPPER_ARG_*` を使ってください。

最後の引数に `rest: true` を付けると、残りの引数をすべて受け取れます。下のツールに
フラグをそのまま渡したいときなどに使います。Bun 内蔵シェルはリストを 1 つずつ扱えない
ため、`rest` には `shell` が必要で、値は `"$@"` で読みます。`rest` の引数には
`SETUPPER_ARG_*` は設定されません。

```yaml
commands:
  test:
    description: テストを実行し、追加のフラグをそのまま渡す
    dir: web-app
    shell: bash
    args:
      - name: flags
        rest: true
    run: npm test -- "$@"
```

`setupper test -- --watch --coverage` は `npm test -- --watch --coverage` を実行します。

## setupper が置き換えるもの（シェル alias との対応）

| シェルのパターン | setupper での表現 |
| --- | --- |
| `alias <name>='… && … && …'` | `commands.<name>.run` のリスト |
| `cd $(git rev-parse --show-toplevel)` | `dir:`（ワークスペースからの相対） |
| <code>cp -n .env.sample .env.local &#124;&#124; true</code> | `cp -n` ステップ / `allow_failure: true` |
| `export SOME_VAR=…` | トップレベルの `env:` |
| `echo "hint…"` | `echo` ステップ |
| ループ / `&` / `trap` を使う `<name>() { … }` 関数 | `shell: zsh` + 複数行の `run:` ブロック |
| `"$1"` / `"$@"` を読む関数 | `args:` + `SETUPPER_ARG_*`（`shell` 指定時は `"$@"` も可） |

## ドキュメント

- English: ルートの [`README.md`](../README.md)
- 日本語: この `docs/README.ja.md`
