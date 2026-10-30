#!/usr/bin/env python3
"""PreToolUse hook that enforces the team protocol in CLAUDE.md.

Blocks (exit code 2):
- Reading / writing / editing secret files (.env, .env.*, *.pem, *.key, secrets/, credentials JSON).
  .env.example is allowed.
- Bash commands that reference secret files (e.g. `cat .env`, `source .env`).
- `git push` that targets main, force pushes (--force, -f, +refspec, --mirror),
  and pushes of all branches (--all / --branches).

Only the Python standard library is used so every team member can run it as-is.
"""
import json
import os
import re
import shlex
import subprocess
import sys

PROTECTED_BRANCH = "main"
ALLOWED_SECRET_LIKE_FILES = {".env.example"}
SEGMENT_SEPARATORS = {";", "&&", "||", "|", "&", "(", ")", "\n"}
# Commands that only inspect paths without reading their contents.
SAFE_PATH_COMMANDS = {("git", "check-ignore")}
PUSH_OPTIONS_WITH_VALUE = {"-o", "--push-option", "--repo", "--receive-pack", "--exec"}
GIT_GLOBAL_OPTIONS_WITH_VALUE = {"-C", "-c", "--git-dir", "--work-tree", "--namespace"}


def is_secret_path(path):
    p = path.strip().strip("'\"").replace("\\", "/")
    if not p:
        return False
    parts = [x for x in p.split("/") if x]
    if not parts:
        return False
    name = parts[-1]
    if name in ALLOWED_SECRET_LIKE_FILES:
        return False
    if name == ".env" or name.startswith(".env."):
        return True
    if name.endswith((".pem", ".key")):
        return True
    if "secrets" in parts:
        return True
    if name.endswith(".json") and ("credentials" in name or name.startswith("service-account")):
        return True
    return False


def tokenize(command):
    try:
        lex = shlex.shlex(command, posix=True, punctuation_chars=True)
        lex.whitespace_split = True
        return list(lex)
    except ValueError:
        return re.split(r"\s+|([;&|()])", command)


def split_segments(tokens):
    segments, current = [], []
    for tok in tokens:
        if not tok:
            continue
        if tok in SEGMENT_SEPARATORS:
            if current:
                segments.append(current)
            current = []
        else:
            current.append(tok)
    if current:
        segments.append(current)
    return segments


def current_branch(cwd):
    try:
        out = subprocess.run(
            ["git", "-C", cwd, "branch", "--show-current"],
            capture_output=True, text=True, timeout=5,
        )
        return out.stdout.strip() if out.returncode == 0 else None
    except Exception:
        return None


def git_subcommand(seg, cwd):
    """Return (subcommand, args, cwd) when seg is a git command, else None."""
    if "git" not in seg:
        return None
    i = seg.index("git") + 1
    while i < len(seg) and seg[i].startswith("-"):
        if seg[i] in GIT_GLOBAL_OPTIONS_WITH_VALUE:
            if seg[i] == "-C" and i + 1 < len(seg):
                cwd = os.path.join(cwd, seg[i + 1])
            i += 2
        else:
            i += 1
    if i >= len(seg):
        return None
    return seg[i], seg[i + 1:], cwd


def targets_protected(dst, branch):
    dst = dst.removeprefix("refs/heads/")
    return dst == PROTECTED_BRANCH or (dst == "HEAD" and branch == PROTECTED_BRANCH)


def check_git_push(args, cwd):
    positional = []
    i = 0
    while i < len(args):
        a = args[i]
        if a in PUSH_OPTIONS_WITH_VALUE:
            i += 2
            continue
        if a.startswith("--force") or a == "--mirror":
            return f"force push（{a}）は禁止です。"
        if a.startswith("-") and not a.startswith("--") and "f" in a[1:]:
            return f"force push（{a}）は禁止です。"
        if a in ("--all", "--branches"):
            return f"{a} は {PROTECTED_BRANCH} を含む全ブランチを push するため禁止です。"
        if not a.startswith("-"):
            positional.append(a)
        i += 1

    branch = current_branch(cwd)
    refspecs = positional[1:]
    if not refspecs:
        if branch == PROTECTED_BRANCH:
            return f"{PROTECTED_BRANCH} ブランチ上での push は禁止です。ブランチを切って PR を作成してください。"
        return None
    for ref in refspecs:
        if ref.startswith("+"):
            return f"force push（{ref}）は禁止です。"
        dst = ref.split(":", 1)[-1]
        if targets_protected(dst, branch):
            return f"{PROTECTED_BRANCH} への直接 push（{ref}）は禁止です。ブランチを切って PR を作成してください。"
    return None


def check_bash(command, cwd):
    for seg in split_segments(tokenize(command)):
        git = git_subcommand(seg, cwd)
        if git and git[0] == "push":
            reason = check_git_push(git[1], git[2])
            if reason:
                return reason
        if git and ("git", git[0]) in SAFE_PATH_COMMANDS:
            continue
        for tok in seg:
            for piece in re.split(r"[^\w./~@+-]+", tok):
                if is_secret_path(piece):
                    return f"機密ファイル（{piece}）を参照するコマンドは禁止です。.env.example を使ってください。"
    return None


def evaluate(data):
    tool = data.get("tool_name", "")
    tool_input = data.get("tool_input") or {}
    cwd = data.get("cwd") or os.getcwd()

    reason = None
    if tool == "Bash":
        reason = check_bash(tool_input.get("command", ""), cwd)
    else:
        for key in ("file_path", "notebook_path", "path"):
            value = tool_input.get(key)
            if isinstance(value, str) and is_secret_path(value):
                reason = f"機密ファイル（{value}）へのアクセスは禁止です。.env.example を使ってください。"
                break
    return reason


# (expected_blocked, tool_name, tool_input). Secret file names are assembled at runtime
# so that the command running the self-test does not itself reference them.
ENV = ".e" + "nv"
SELF_TEST_CASES = [
    (True, "Read", {"file_path": f"app/{ENV}"}),
    (True, "Read", {"file_path": f"app/{ENV}.production"}),
    (False, "Read", {"file_path": f"app/{ENV}.example"}),
    (True, "Write", {"file_path": f"{ENV}.local"}),
    (True, "Read", {"file_path": "certs/server.pem"}),
    (False, "Read", {"file_path": "src/main.py"}),
    (True, "Bash", {"command": f"cat {ENV}"}),
    (True, "Bash", {"command": f"source ./{ENV} && npm start"}),
    (False, "Bash", {"command": f"cat {ENV}.example"}),
    (False, "Bash", {"command": f"git check-ignore -v {ENV}"}),
    (True, "Bash", {"command": "git push origin main"}),
    (True, "Bash", {"command": "git push origin HEAD:main"}),
    (True, "Bash", {"command": "git push origin feature/x:refs/heads/main"}),
    (True, "Bash", {"command": "git push origin feature/x --force"}),
    (True, "Bash", {"command": "git push -f origin feature/x"}),
    (True, "Bash", {"command": "git push origin +feature/x"}),
    (True, "Bash", {"command": "git push --all origin"}),
    (True, "Bash", {"command": "npm test && git push origin main"}),
    (False, "Bash", {"command": "git push -u origin feature/x"}),
    (False, "Bash", {"command": "git commit -m 'update main docs'"}),
]


def self_test():
    failures = 0
    for expected, tool, tool_input in SELF_TEST_CASES:
        blocked = evaluate({"tool_name": tool, "tool_input": tool_input, "cwd": "/nonexistent"}) is not None
        ok = blocked == expected
        failures += not ok
        print(f"{'OK  ' if ok else 'FAIL'} {'block' if expected else 'allow'}: {tool} {tool_input}")
    print(f"{len(SELF_TEST_CASES) - failures}/{len(SELF_TEST_CASES)} passed")
    return 1 if failures else 0


def main():
    if "--self-test" in sys.argv[1:]:
        return self_test()
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    reason = evaluate(data)
    if reason:
        print(f"[team-protocol] {reason}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
