// Run the fictional-product scenarios separately from the existing checks.
// Includes the sequential specification-import regression fixed on 2026-11-05.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
let failed = false;
for (const file of ['product-cost-scenarios.cjs', 'archive-product-scenarios.cjs', 'linked-product-scenarios.cjs']) {
  const args = [path.join(__dirname, file)];
  const result = spawnSync(process.execPath, args, { cwd: path.resolve(__dirname, '../..'), stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
