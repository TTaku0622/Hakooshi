# Progate_hackathon

Progate ハッカソン チーム開発用リポジトリ。

## はじめに（チームメンバー向け）

チームのルールは **`AGENTS.md`** にまとめています（Claude Code と Codex で共通）。

```bash
git clone https://github.com/TTaku0622/Progate_hackathon.git
cd Progate_hackathon
```

### Claude Code を使う人

```bash
claude
```
```
/progate-hackathon-setup
```

スキルが次のファイルを作ります（何度実行しても同じ結果になります）。

| ファイル | 内容 | コミット |
|---|---|---|
| `CLAUDE.md` | `AGENTS.md` と `docs/PRODUCT.md` を読み込む入口（テンプレートから生成） | しない |
| `CLAUDE.local.md` | 個人の好み・設定（自由に編集） | しない |

`.claude/settings.json` と `.claude/hooks/guard.py`（機密ファイル・main への push・force push をブロック）はコミット済みなので、clone した時点で有効です。

### Codex を使う人

リポジトリ直下で `codex` を起動するだけです。`AGENTS.md` が自動で読み込まれます。

- 個人の好みは `~/.codex/AGENTS.md` に書きます。
- Claude Code のようなブロック用フックはないので、`.env` を読ませない・main に push しないといったルールは `AGENTS.md` の指示が頼りです。承認モードは、コマンド実行前に確認が出る設定で使ってください。

### 共通

- ルールを変えるときは `AGENTS.md` を直して PR を出します。
- 環境変数が必要になったら `cp .env.example .env` で各自作成します（`.env` はコミットしない）。

## 開発ルール（要約）

- main に直接 push しない。`feature/〇〇` / `fix/〇〇` / `change/〇〇` ブランチ → PR
- コミットメッセージは英語・命令形・1行（例: `Add login form`）
- push 前にセキュリティ・整合性・動作確認のチェックをし、結果を PR 本文に書く
- merge 前にメンバーか AI（Claude Code の `/code-review`、Codex の `/review`）のレビューを挟む

詳しくは [AGENTS.md](AGENTS.md)。

## 通知

GitHub の更新はチームの Discord に Webhook で通知されます。
