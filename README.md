# Progate_hackathon

Progate ハッカソン チーム開発用リポジトリ。

## はじめに（チームメンバー向け）

```bash
git clone https://github.com/TTaku0622/Progate_hackathon.git
cd Progate_hackathon
cp .env.example .env   # 必要な値はチームで共有されたものを入れる
```

## AI エージェントのセットアップ

ルールは **`AGENTS.md` 1か所** にまとめています。各エージェントはここを自動で読むので、基本は clone するだけで使えます。

| 使うエージェント | 読むファイル | やること |
|---|---|---|
| Claude Code | `CLAUDE.md`（→ `AGENTS.md` を読み込む）、`.claude/settings.json` | リポジトリ直下で `claude` を起動するだけ |
| Codex CLI | `AGENTS.md` | リポジトリ直下で `codex` を起動するだけ |
| Cursor | `AGENTS.md` | このフォルダを開くだけ |
| GitHub Copilot（VS Code） | `.github/copilot-instructions.md` | このフォルダを開くだけ |
| その他（Gemini CLI など） | — | 最初に「AGENTS.md を読んで従って」と伝える |

### 個人の設定を足したいとき

- Claude Code: `.claude/settings.local.json` や `CLAUDE.local.md` に書く（`.gitignore` 済みでコミットされない）
- チーム全員に効かせたいルールは `AGENTS.md` を直して PR を出す

### 共有している Claude Code の設定（`.claude/settings.json`）

- コミットに Claude の署名（Co-Authored-By）を付けない
- `.env` を読ませない、`git push --force` をさせない
- `git status` / `diff` / `log` / `branch` は確認なしで実行できる

## 開発ルール（要約）

- main に直接 push しない。`feature/xxx` ブランチ → PR
- コミットメッセージは英語・命令形・1行（例: `Add login form`）
- API キーや Webhook URL は `.env` に置き、コミットしない

詳しくは [AGENTS.md](AGENTS.md)。

## 通知

GitHub の更新はチームの Discord に Webhook で通知されます。
