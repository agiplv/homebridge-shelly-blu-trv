const fs = require('fs');
const path = require('path');

const LCOV = path.join(process.cwd(), 'coverage', 'lcov.info');
const threshold = Number(process.env.COVERAGE_THRESHOLD || 80);

if (!fs.existsSync(LCOV)) {
  console.error('No lcov.info found; run tests with coverage first.');
  process.exit(2);
}

const data = fs.readFileSync(LCOV, 'utf8');
let totalLF = 0;
let totalLH = 0;

const lines = data.split('\n');
for (const line of lines) {
  if (line.startsWith('LF:')) totalLF += Number(line.slice(3));
  if (line.startsWith('LH:')) totalLH += Number(line.slice(3));
}

if (totalLF === 0) {
  console.error('No lines found in lcov (LF==0)');
  process.exit(2);
}

const pct = (totalLH / totalLF) * 100;
console.log(`Coverage lines: ${pct.toFixed(2)}% (threshold ${threshold}%)`);
if (pct < threshold) {
  console.error('Coverage threshold not met');
  process.exit(1);
}
console.log('Coverage OK');
process.exit(0);
