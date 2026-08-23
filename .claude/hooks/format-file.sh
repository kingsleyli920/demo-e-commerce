#!/usr/bin/env bash
# PostToolUse(Edit|Write)：用 prettier 格式化刚修改的文件（仅限项目内、prettier 支持的扩展名）。
set -uo pipefail
input=$(cat)
file=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(String((j.tool_input&&j.tool_input.file_path)||""))}catch{process.stdout.write("")}})')
[ -z "$file" ] && exit 0
case "$file" in
  "$CLAUDE_PROJECT_DIR"/*) ;;
  *) exit 0 ;;
esac
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.md|*.yml|*.yaml) ;;
  *) exit 0 ;;
esac
case "$file" in
  */node_modules/*|*/.next/*|*/drizzle/*|*/pnpm-lock.yaml) exit 0 ;;
esac
cd "$CLAUDE_PROJECT_DIR" && pnpm exec prettier --log-level warn --write "$file" >/dev/null 2>&1 || true
exit 0
