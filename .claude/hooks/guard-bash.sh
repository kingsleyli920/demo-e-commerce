#!/usr/bin/env bash
# PreToolUse(Bash) 守卫：拦截破坏性命令。退出码 2 = 阻止并把 stderr 反馈给 Claude。
# 策略：按 ; && || | 换行拆分为独立命令段，逐段判定，避免整条命令的白名单误放行。
set -euo pipefail
input=$(cat)
cmd=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(String((j.tool_input&&j.tool_input.command)||""))}catch{process.stdout.write("")}})')
[ -z "$cmd" ] && exit 0

node - "$cmd" <<'NODE'
const cmd = process.argv[2] ?? '';
const block = (reason, seg) => {
  console.error(`[guard-bash] 已拦截危险命令（${reason}）：${seg.trim().slice(0, 120)}\n如确需执行，请人工在终端操作。`);
  process.exit(2);
};
// 去掉行尾注释（粗略：以 空格# 开头到行尾），再按分隔符拆段
const segments = cmd
  .split(/\n|;|&&|\|\||\|/)
  .map((s) => s.replace(/\s#[^\n]*$/g, '').trim())
  .filter(Boolean);

const SAFE_RM_TARGETS = [
  /^node_modules\/?$/, /^\.?\/?node_modules\/?/, /^\.next\/?/, /^\.?\/?\.next\/?/,
  /^coverage\/?/, /^playwright-report\/?/, /^test-results\/?/, /^blob-report\/?/,
  /^out\/?$/, /^dist\/?$/, /^reports\/?/, /^\/private\/tmp\/claude-/, /^\.playwright-mcp\/?/,
  /^playwright\/\.auth\/?/, /^drizzle\/?$/,
];

for (const seg of segments) {
  // 词法拆分（简化：按空白，忽略引号内空格的少见情形——宁可误拦不可漏拦）
  const tokens = seg.split(/\s+/);
  // 跳过 env 前缀与 sudo/xargs 包装
  let i = 0;
  while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) i++;
  if (tokens[i] === 'sudo' || tokens[i] === 'command') i++;
  const cmd0 = tokens[i] ?? '';
  const rest = tokens.slice(i + 1);

  if (cmd0 === 'rm') {
    let recursive = false, force = false;
    const targets = [];
    for (const t of rest) {
      if (t === '--') continue;
      if (t === '--recursive') { recursive = true; continue; }
      if (t === '--force') { force = true; continue; }
      if (/^--/.test(t)) continue;
      if (/^-[A-Za-z]+$/.test(t)) {
        if (/[rR]/.test(t)) recursive = true;
        if (/f/.test(t)) force = true;
        continue;
      }
      targets.push(t.replace(/^['"]|['"]$/g, ''));
    }
    if (recursive && force) {
      const allSafe = targets.length > 0 && targets.every((p) => SAFE_RM_TARGETS.some((re) => re.test(p)));
      if (!allSafe) block('rm -rf（目标不在安全清单）', seg);
    }
    continue;
  }

  if (/^drizzle-kit$/.test(cmd0) && rest[0] === 'drop') block('drizzle-kit drop', seg);
  if ((cmd0 === 'pnpm' || cmd0 === 'npx' || cmd0 === 'pnpx') && rest.includes('drizzle-kit') && rest.includes('drop'))
    block('drizzle-kit drop', seg);

  if (cmd0 === 'git') {
    const sub = rest[0];
    if (sub === 'push' && rest.some((t) => t === '--force' || t === '-f' || /^\+/.test(t)))
      block('git push --force', seg);
    if (sub === 'reset' && rest.includes('--hard')) block('git reset --hard', seg);
    if (sub === 'clean' && rest.some((t) => /^-[A-Za-z]*f/.test(t))) block('git clean -f', seg);
    if (sub === 'checkout' && rest.includes('--') && rest.includes('.')) block('git checkout -- .', seg);
    if (sub === 'branch' && rest.includes('-D') && rest.some((t) => t === 'main' || t === 'dev'))
      block('git branch -D main/dev', seg);
  }

  if (cmd0 === 'docker') {
    if (rest[0] === 'compose' && rest.includes('down') && rest.some((t) => t === '-v' || t === '--volumes'))
      block('docker compose down -v', seg);
    if (rest[0] === 'volume' && (rest.includes('rm') || rest.includes('prune'))) block('docker 删卷', seg);
    if (rest[0] === 'system' && rest.includes('prune')) block('docker system prune', seg);
  }

  // SQL 破坏性语句：只在明确执行 SQL 的命令段里检查（psql / drizzle-kit push 等），
  // 避免 grep/git commit -m 里的字样被误拦；shop_test 测试库放行。
  const execsSql = /(^|\s)psql(\s|$)/.test(seg) || /drizzle/.test(seg);
  if (execsSql && /(DROP\s+(DATABASE|SCHEMA)|TRUNCATE)\s/i.test(seg) && !/shop_test/.test(seg)) {
    block('SQL DROP/TRUNCATE（非测试库）', seg);
  }
}
process.exit(0);
NODE
