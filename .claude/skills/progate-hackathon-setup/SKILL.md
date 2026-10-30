---
name: progate-hackathon-setup
description: Progate ハッカソン チーム共通の開発プロトコルをリポジトリにセットアップする。AGENTS.md を読み込む CLAUDE.md・.gitignore・.claude/settings.json・保護フック・CLAUDE.local.md.example を全員同一内容で生成し、個人用の CLAUDE.local.md を作成する。「セットアップして」「開発プロトコルを生成」「CLAUDE.mdを作って」「progate-hackathon-setup」と言われたとき、またはリポジトリを clone した直後に使用する。
allowed-tools: [Bash, Read, Write, Edit]
---

# Progate ハッカソン チームセットアップスキル

Claude Code を使うメンバーが、チーム共通の開発プロトコル（`AGENTS.md`、Codex と共有）に従えるよう、共通ファイルをテンプレートから生成する。`AGENTS.md` はコミット済みの正本なので、このスキルでは生成しない。
何度実行しても同じ結果になる（冪等）ので、clone 直後のメンバーも同じスキルを実行すればよい。

## 生成するファイル

| ファイル | テンプレート | 種別 | 同期方法 |
|----------|--------------|------|----------|
| `CLAUDE.md` | `templates/CLAUDE.md` | `AGENTS.md` と `docs/PRODUCT.md` を読み込む Claude Code 用の入口（**コミットしない**。各自がこのスキルで生成） | テンプレートと完全一致させる |
| `.claude/settings.json` | `templates/settings.json` | チーム共通（deny ルール＋フック登録） | テンプレートと完全一致させる |
| `.claude/hooks/guard.py` | `templates/hooks/guard.py` | チーム共通（機密ファイル・main push・force push をブロック） | テンプレートと完全一致させる |
| `CLAUDE.local.md.example` | `templates/CLAUDE.local.md.example` | 個人設定の雛形 | テンプレートと完全一致させる |
| `.gitignore` | `templates/gitignore` | チーム共通 | 不足行のみ追記（既存行は残す） |
| `docs/PRODUCT.md` | `templates/PRODUCT.md` | プロダクト情報（チームで自由に編集） | 無いときだけ作成。以後は比較しない |
| `CLAUDE.local.md` | `templates/CLAUDE.local.md.example` | 個人設定（各自カスタマイズ・**コミットしない**） | 無いときだけ作成。既存は絶対に触らない |

- **正本はテンプレート**（`${CLAUDE_SKILL_DIR}/templates/`）。チーム共通ルールを変えるときはテンプレートを編集し、このスキルを再実行してリポジトリ直下へ同期する。直下のファイルだけを直接編集しない。
- `CLAUDE.md` は `.gitignore` 済みでリポジトリには置かない。チームで共有されるのはテンプレートなので、テンプレートが更新されたら（pull 後など）各自このスキルを再実行して手元の `CLAUDE.md` を更新する。
- チームのルールは `AGENTS.md`、プロダクト固有の情報は `docs/PRODUCT.md` に書き、`CLAUDE.md` からは `@AGENTS.md`・`@docs/PRODUCT.md` で読み込む。そのため `CLAUDE.md` は常にテンプレートと一致する。
- 前提：フックの実行に `python3` が必要（macOS は標準で入っている）。

---

## 実行手順

### Step 1: リポジトリルートとテンプレートの特定

```bash
ROOT=$(git rev-parse --show-toplevel)
T="${CLAUDE_SKILL_DIR:-$ROOT/.claude/skills/progate-hackathon-setup}/templates"
ls "$T/CLAUDE.md" "$T/settings.json" "$T/hooks/guard.py"
```

- git リポジトリでなければ中止し、`git init` または clone が必要だとユーザーに伝える。
- テンプレートが見つからなければ中止する。以降のパスはすべて `$ROOT` 基準。

### Step 2: 各ファイルの状態判定（まだ何も変更しない）

```bash
for pair in "CLAUDE.md:CLAUDE.md" "CLAUDE.local.md.example:CLAUDE.local.md.example" \
            ".claude/settings.json:settings.json" ".claude/hooks/guard.py:hooks/guard.py"; do
  dst="$ROOT/${pair%%:*}"; src="$T/${pair##*:}"
  if [ ! -e "$dst" ]; then echo "NEW      ${pair%%:*}"
  elif cmp -s "$src" "$dst"; then echo "SAME     ${pair%%:*}"
  else echo "DIFFERS  ${pair%%:*}"; fi
done
if [ ! -e "$ROOT/.gitignore" ]; then echo "NEW      .gitignore"
else
  missing=$(grep -vxF -f "$ROOT/.gitignore" "$T/gitignore" | grep -v '^[[:space:]]*$' | grep -v '^#')
  [ -n "$missing" ] && echo "APPEND   .gitignore" || echo "SAME     .gitignore"
fi
[ -e "$ROOT/docs/PRODUCT.md" ] && echo "SAME     docs/PRODUCT.md" || echo "NEW      docs/PRODUCT.md"
```

| 状態 | 対応 |
|------|------|
| `NEW` | Step 4 でテンプレートから作成する |
| `SAME` | 何もしない（スキップ） |
| `APPEND` | `.gitignore` に不足行のみ追記する |
| `DIFFERS` | `diff -u "<テンプレート>" "<既存ファイル>"` を見せて状況を説明し、ユーザーに選んでもらう |

`DIFFERS` の選択肢（**テンプレートと直下のずれ＝ドリフト**として報告する）:
- **テンプレートで上書き**：直下のファイルを誰かが直接編集した場合。必要な変更はテンプレート側へ移してから上書きする。
- **直下の内容をテンプレートへ反映**：直下の変更を正とする場合。テンプレートを更新し、直下はそのまま SAME にする。
- **何もしない**：今回は同期しない。

### Step 3: ブランチの確認（ファイルを変更する前に必ず行う）

Step 2 でチーム共通ファイル（`CLAUDE.local.md` 以外）に `NEW` / `APPEND` / 同期する `DIFFERS` が 1 つでもある場合、**ファイルを変更する前に**ブランチを確認する。

```bash
git -C "$ROOT" branch --show-current
```

- `main` の場合：`git -C "$ROOT" switch -c change/team-protocol-setup` でブランチを作る（初回導入なら `feature/team-protocol-setup`）。
- それ以外のブランチの場合：関係ない作業ブランチに混ざらないよう、「このブランチに含める」か「main から新しいブランチを切る」かをユーザーに確認する。
- 変更が `CLAUDE.local.md` の作成だけなら、ブランチ操作は不要。

### Step 4: テンプレートからファイルを作成・同期

通常ファイルは Bash でコピーする:

```bash
cp "$T/CLAUDE.md" "$ROOT/CLAUDE.md"                              # NEW / 上書き承認時のみ
cp "$T/CLAUDE.local.md.example" "$ROOT/CLAUDE.local.md.example"  # NEW / 上書き承認時のみ
cp "$T/gitignore" "$ROOT/.gitignore"                             # .gitignore が NEW のときのみ
[ -e "$ROOT/docs/PRODUCT.md" ] || { mkdir -p "$ROOT/docs" && cp "$T/PRODUCT.md" "$ROOT/docs/PRODUCT.md"; }
```

**`.claude/settings.json` と `.claude/hooks/guard.py` は Bash の `cp` で書かない。** Claude Code やサンドボックスの保護対象で失敗することがあるため、テンプレートを Read ツールで読み、同じ内容を Write ツールで書き込む（NEW / 上書き承認時のみ）。

`.gitignore` が `APPEND` の場合は不足行を末尾に追記する。順序によって `.env.example` が再び除外されないよう、ブロックの最後に必ず `!.env.example` を置く:

```bash
missing=$(grep -vxF -f "$ROOT/.gitignore" "$T/gitignore" | grep -v '^[[:space:]]*$' | grep -v '^#' | grep -vxF '!.env.example')
[ -n "$missing" ] && printf '\n# ===== progate-hackathon-setup =====\n%s\n!.env.example\n' "$missing" >> "$ROOT/.gitignore"
```

### Step 5: 個人用 CLAUDE.local.md の作成

```bash
[ -e "$ROOT/CLAUDE.local.md" ] || cp "$T/CLAUDE.local.md.example" "$ROOT/CLAUDE.local.md"
```

- 既存の `CLAUDE.local.md` は**絶対に上書き・編集しない**（個人の設定が消えるため）。

### Step 6: 検証

```bash
# 1) JSON とドリフト
python3 -m json.tool "$ROOT/.claude/settings.json" > /dev/null && echo "settings.json OK"
for pair in "CLAUDE.md:CLAUDE.md" "CLAUDE.local.md.example:CLAUDE.local.md.example" \
            ".claude/settings.json:settings.json" ".claude/hooks/guard.py:hooks/guard.py"; do
  cmp -s "$T/${pair##*:}" "$ROOT/${pair%%:*}" && echo "SAME ${pair%%:*}" || echo "DRIFT ${pair%%:*}"
done

# 2) ignore 設定（.env と CLAUDE.local.md は除外、.env.example と CLAUDE.local.md.example は追跡対象）
git -C "$ROOT" check-ignore -q .env && git -C "$ROOT" check-ignore -q CLAUDE.local.md && echo "ignored OK"
git -C "$ROOT" check-ignore -q .env.example || git -C "$ROOT" check-ignore -q CLAUDE.local.md.example || echo "tracked OK"

# 3) フックの動作（機密ファイル・main push・force push のブロック／通常操作の許可を自己テスト）
python3 "$ROOT/.claude/hooks/guard.py" --self-test
git -C "$ROOT" status --short
```

いずれかが期待と違う場合は報告し、コミットしない。

### Step 7: コミットと PR（チーム共通ファイルに変更があった場合のみ）

1. 変更したチーム共通ファイルのみを `git add` してコミットする（`CLAUDE.md`・`CLAUDE.local.md` は含めない）。
2. AGENTS.md の「4. push 前チェック」を行う。
3. push と `gh pr create --base main` は**ユーザーに確認してから**実行する。

`CLAUDE.local.md` の作成だけだった場合は、コミット不要。

### Step 8: 結果報告

以下をまとめて報告する。

- 各ファイルの結果（作成 / スキップ / 上書き / 追記 / ドリフト）
- 個人の好みは `CLAUDE.local.md` に、プロダクト情報は `docs/PRODUCT.md` に書けること
- 新しいセッションで `/memory` を開くと `CLAUDE.md`（`AGENTS.md` を含む）・`CLAUDE.local.md` が読み込まれていること、`/hooks` でフックが登録されていることを確認できること
- 環境変数が必要になったら `.env.example` を元に `cp .env.example .env` で各自作成すること
- GitHub の branch protection（main への直接 push 禁止・PR 必須）を設定すると、Claude 以外の操作も防げること

## 注意事項

- このスキルは `.env` など機密情報を含むファイルを読まない・作成しない。
- テンプレートにプロジェクト名・プロダクト名は記述しない（`docs/PRODUCT.md` に書く）。
- フックはよくある抜け道を塞ぐためのもので、完全な防御ではない（例：`grep -r` で中身を検索するコマンドは防げない）。最後の砦として GitHub の branch protection と、秘密情報を Git に入れない運用を併用する。
