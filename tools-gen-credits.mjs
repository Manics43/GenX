import { CREDITS } from './js/credits.js';
const plugins = [...new Set(CREDITS.map((c) => c.plugin))];
let md = `# Credits\n\nGenX's engine is modeled on **${CREDITS.length} open-source VCV Rack modules** from **${plugins.length} plugins**. GenX re-implements the *behaviour* of these modules in its own JavaScript DSP with fixed internal routing (no patch cables). No source code or panel graphics are copied; each plugin keeps its own license. Panel artwork of most VCV plugins is CC BY-NC-ND and must never be copied into GenX.\n\nGenerated from \`js/credits.js\` (run \`node tools-gen-credits.mjs > CREDITS.md\`).\n\n## Plugins\n\n| Plugin | Repository | License |\n|---|---|---|\n`;
for (const p of plugins) { const c = CREDITS.find((x) => x.plugin === p); md += `| ${p} | ${c.repo} | ${c.license} |\n`; }
md += `\n## Modules\n\n| # | Module | Plugin | Slug | GenX section | What GenX models |\n|---|---|---|---|---|---|\n`;
CREDITS.forEach((c, i) => (md += `| ${i + 1} | ${c.module} | ${c.plugin} | \`${c.slug}\` | ${c.genx} | ${c.usedFor} |\n`));
process.stdout.write(md);
