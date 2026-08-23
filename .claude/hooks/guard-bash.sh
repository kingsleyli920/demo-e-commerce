#!/usr/bin/env bash
# PreToolUse(Bash) 守卫：拦截破坏性命令。退出码 2 = 阻止并把 stderr 反馈给 Claude。
set -euo pipefail
input=$(cat)
cmd=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(String((j.tool_input&&j.tool_input.command)||""))}catch{process.stdout.write("")}})')
block() { echo "[guard-bash] 已拦截危险命令（$1）。如确需执行，请人工在终端操作。" >&2; exit 2; }
# rm -rf / rm -fr（含 rm -r -f 等变体）且目标不在 scratchpad/node_modules/.next 之类的安全目录
if printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])rm[[:space:]]+(-[a-zA-Z]*[rR][a-zA-Z]*[[:space:]]+-?[a-zA-Z]*[fF]|-[a-zA-Z]*[fF][a-zA-Z]*[[:space:]]+-?[a-zA-Z]*[rR]|-[a-zA-Z]*([rR][a-zA-Z]*[fF]|[fF][a-zA-Z]*[rR])[a-zA-Z]*)'; then
  if ! printf '%s' "$cmd" | grep -Eq 'rm[[:space:]]+-[a-zA-Z]+[[:space:]]+("?)(/private/tmp/claude-|\./?(node_modules|\.next|coverage|playwright-report|test-results|blob-report|out|dist)(/|[[:space:]]|"|$)|node_modules|\.next|coverage|playwright-report|test-results|blob-report)'; then
    block "rm -rf"
  fi
fi
printf '%s' "$cmd" | grep -Eq 'drizzle-kit[[:space:]]+drop' && block "drizzle-kit drop"
printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+push[[:space:]].*(--force|-f([[:space:]]|$)|\+[a-zA-Z])' && block "git push --force"
printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+(reset[[:space:]]+--hard|clean[[:space:]]+-[a-zA-Z]*f|checkout[[:space:]]+--[[:space:]]+\.|branch[[:space:]]+-D[[:space:]]+(main|dev))' && block "git 破坏性操作"
printf '%s' "$cmd" | grep -Eq 'docker[[:space:]]+(compose[[:space:]]+down[[:space:]].*(-v|--volumes)|volume[[:space:]]+(rm|prune)|system[[:space:]]+prune)' && block "docker 删卷"
printf '%s' "$cmd" | grep -Eq '(DROP[[:space:]]+(DATABASE|SCHEMA)|TRUNCATE)[[:space:]]' && ! printf '%s' "$cmd" | grep -Eq 'shop_test' && block "SQL DROP/TRUNCATE（非测试库）"
exit 0
