const { spawn } = require('child_process');
const path = require('path');

const TIMEOUT = process.env.E2E_TIMEOUT ? Number(process.env.E2E_TIMEOUT) : 60_000;
const cwd = process.cwd();
const hbTestDir = path.join(cwd, 'hb-test');

function runProcess(command, args, opts = {}) {
  const cp = spawn(command, args, Object.assign({ shell: true }, opts));
  cp.stdout.setEncoding('utf8');
  cp.stderr.setEncoding('utf8');
  return cp;
}

const { execSync } = require('child_process');

console.log('Installing dependencies (npm ci)...');
try {
  execSync('npm install --no-audit --no-fund', { stdio: 'inherit', cwd });
} catch (err) {
  console.error('npm ci failed, aborting e2e');
  process.exit(2);
}

console.log('Building project (npm run build)...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd });
} catch (err) {
  console.error('Build failed, aborting e2e');
  process.exit(2);
}

console.log('Installing local package shim into node_modules...');
try {
  const nm = require('path').join(cwd, 'node_modules', 'homebridge-shelly-blu-trv');
  require('fs').mkdirSync(nm, { recursive: true });
  require('fs').writeFileSync(require('path').join(nm, 'index.js'), "module.exports = require('../../dist/index.js');\n");
  require('fs').writeFileSync(require('path').join(nm, 'package.json'), JSON.stringify({ name: 'homebridge-shelly-blu-trv', version: require(require('path').join(cwd,'package.json')).version, keywords: ['homebridge-plugin','homebridge-platform'], engines: { homebridge: '>=1.6.0' }, main: 'index.js' }, null, 2));
  console.log('shim written to', nm);
} catch (err) {
  console.error('Failed to write shim into node_modules', err);
  process.exit(2);
}

console.log('Killing any running Homebridge processes...');
try {
  execSync('pkill -f homebridge || true', { stdio: 'ignore' });
} catch (err) {}

console.log('Starting fake gateway...');
const gateway = runProcess('node', ['hb-test/fake-gateway.js'], { cwd });

let gatewayOut = '';
gateway.stdout.on('data', (d) => { gatewayOut += d; process.stdout.write(`[gateway] ${d}`); });
gateway.stderr.on('data', (d) => { process.stderr.write(`[gateway:err] ${d}`); });

gateway.on('exit', (code) => { console.log('Gateway exited with', code); });

console.log('Starting Homebridge...');
const env = Object.assign({}, process.env, { HOME: hbTestDir });
const homebridge = runProcess('npx', ['--yes', 'homebridge', '-I', '-D'], { cwd, env });

let hbOut = '';
let discovered = false;
let polling = false;

homebridge.stdout.on('data', (d) => {
  const s = String(d);
  hbOut += s;
  process.stdout.write(`[hb] ${s}`);
  if (!discovered && s.includes('Discovered 1 TRV')) discovered = true;
  if (!polling && s.includes('Polling state for TRV')) polling = true;
});
homebridge.stderr.on('data', (d) => { process.stderr.write(`[hb:err] ${d}`); });

function shutdown(code = 0) {
  try { gateway.kill(); } catch (e) {}
  try { homebridge.kill(); } catch (e) {}
  process.exit(code);
}

const start = Date.now();
const interval = setInterval(() => {
  if (discovered && polling) {
    console.log('E2E: discovery and polling observed — success');
    clearInterval(interval);
    shutdown(0);
  }
  if (Date.now() - start > TIMEOUT) {
    console.error('E2E: timeout — did not observe discovery & polling');
    console.error('--- Homebridge logs ---');
    console.error(hbOut.slice(-2000));
    console.error('--- Gateway logs ---');
    console.error(gatewayOut.slice(-2000));
    clearInterval(interval);
    shutdown(1);
  }
}, 1000);

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(130));
