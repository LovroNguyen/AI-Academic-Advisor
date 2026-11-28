// AcadAI one-time setup (Windows, macOS, Linux). Run with:  node setup.mjs   (or double-click setup.bat)
//
// It installs the dependencies, writes backend/.env and face-service/.env with random secrets,
// creates the database tables and loads the demo data. Re-running it is safe: existing .env files
// are kept unless you pass --reset-env.
//
// Options (all optional):
//   --db-url=postgresql://user:password@localhost:5432/acadai   skip the database questions
//   --reset-env      overwrite existing .env files
//   --skip-face      do not set up the Python face-recognition service
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
const isWin = process.platform === 'win32';

const step = (n, t) => console.log(`\n[${n}/6] ${t}`);
const fail = (msg) => { console.error(`\nSetup stopped: ${msg}`); process.exit(1); };
function run(cmd, cmdArgs, cwd, { allowFail = false } = {}) {
  console.log(`  > ${cmd} ${cmdArgs.join(' ')}`);
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: isWin });
  if (r.status !== 0 && !allowFail) fail(`"${cmd} ${cmdArgs.join(' ')}" failed in ${cwd}`);
  return r.status === 0;
}
function has(cmd, versionArg = '--version') {
  const r = spawnSync(cmd, [versionArg], { encoding: 'utf8', shell: isWin });
  return r.status === 0 ? (r.stdout || r.stderr).trim() : null;
}
const secret = () => randomBytes(32).toString('base64url');

console.log('AcadAI setup');
console.log('============');

// 1. Check the tools -----------------------------------------------------------------------------
step(1, 'Checking Node.js, npm and Python');
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 20 || (maj === 20 && min < 12)) fail(`Node.js 20.12 or newer is required (found ${process.versions.node}).`);
console.log(`  Node.js ${process.versions.node}: OK`);
if (!has('npm')) fail('npm was not found.');
const python = ['python', 'python3', 'py'].find((p) => has(p));
const skipFace = args['skip-face'] || !python;
console.log(python ? `  ${has(python)}: OK` : '  Python not found: the face-recognition service will be skipped (everything else works).');

// 2. Database connection and .env files ---------------------------------------------------------
step(2, 'Configuring backend/.env and face-service/.env');
const backendEnv = join(ROOT, 'backend', '.env');
const faceEnv = join(ROOT, 'face-service', '.env');
let dbUrl = typeof args['db-url'] === 'string' ? args['db-url'] : null;
const keepEnv = existsSync(backendEnv) && !args['reset-env'];

if (keepEnv) {
  console.log('  backend/.env already exists: keeping it (use --reset-env to recreate it).');
  dbUrl = (readFileSync(backendEnv, 'utf8').match(/^DATABASE_URL="?([^"\r\n]+)"?/m) || [])[1];
  if (!dbUrl) fail('backend/.env has no DATABASE_URL.');
} else {
  if (!dbUrl) {
    console.log('  Enter your PostgreSQL details (press Enter to accept the value in brackets).');
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ask = async (q, d) => (await rl.question(`  ${q} [${d}]: `)).trim() || d;
    const host = await ask('Host', 'localhost');
    const port = await ask('Port', '5432');
    const user = await ask('User', 'postgres');
    const pass = await rl.question('  Password: ');
    const db = await ask('Database name (created if missing)', 'acadai');
    rl.close();
    dbUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}?schema=public`;
  }
  const faceKey = secret();
  writeFileSync(backendEnv, [
    '# Created by setup.mjs. Never commit this file.',
    `DATABASE_URL="${dbUrl}"`,
    `JWT_SECRET="${secret()}"`,
    'JWT_EXPIRES_IN="7d"',
    'PORT=3000',
    '',
    '# AI providers (optional). With no key the advisor answers with its built-in rule-based answers.',
    '# Main provider: paste a Claude API key from platform.claude.com between the quotes.',
    'ANTHROPIC_API_KEY=""',
    'CLAUDE_MODEL="claude-haiku-5-5"',
    '# Backup provider: free OpenRouter models.',
    'OPENROUTER_API_KEY=""',
    'OPENROUTER_MODEL="openrouter/free"',
    '',
    'FACE_SERVICE_URL="http://127.0.0.1:8001"',
    `FACE_SERVICE_API_KEY="${faceKey}"`,
    '',
  ].join('\n'));
  writeFileSync(faceEnv, [
    '# Created by setup.mjs. Must match FACE_SERVICE_API_KEY in backend/.env.',
    `FACE_SERVICE_API_KEY=${faceKey}`,
    'FACE_ALLOWED_ORIGINS=',
    'FACE_SERVICE_HOST=127.0.0.1',
    '',
  ].join('\n'));
  console.log('  Wrote backend/.env and face-service/.env with new random secrets.');
}

// 3. Backend ---------------------------------------------------------------------------------------
step(3, 'Installing the backend and creating the database');
const backend = join(ROOT, 'backend');
run('npm', ['install', '--no-audit', '--no-fund'], backend);
run('npx', ['prisma', 'generate'], backend);
// "migrate dev" would prompt; "migrate deploy" applies the committed migrations. Prisma creates
// the database itself if it does not exist yet.
run('npx', ['prisma', 'migrate', 'deploy'], backend);

// 4. Demo data -------------------------------------------------------------------------------------
step(4, 'Loading the demo data (accounts, 20 classes, about 60 students, career roadmaps)');
run('npx', ['ts-node', 'prisma/seed-large.ts'], backend);
run('npx', ['ts-node', 'prisma/seed-roadmaps.ts'], backend);

// 5. Frontend --------------------------------------------------------------------------------------
step(5, 'Installing the frontend');
run('npm', ['install', '--no-audit', '--no-fund'], join(ROOT, 'frontend'));

// 6. Face service ----------------------------------------------------------------------------------
step(6, 'Setting up the face-recognition service (Python)');
if (skipFace) {
  console.log('  Skipped.');
} else {
  const face = join(ROOT, 'face-service');
  if (!existsSync(join(face, 'venv'))) run(python, ['-m', 'venv', 'venv'], face);
  const pip = isWin ? join(face, 'venv', 'Scripts', 'python.exe') : join(face, 'venv', 'bin', 'python');
  run(pip, ['-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', '-r', 'requirements.txt'], face, { allowFail: true })
    || console.log('  Could not install the Python packages. Face attendance will not work; everything else does.');
}

console.log(`
Setup complete.

Start AcadAI:   ${isWin ? 'double-click start.bat' : 'see README.md, "Getting started"'}
Then open:      http://localhost:5173

Demo accounts (the login page has quick-fill buttons for them):
  Administrator  admin@fpt.edu.vn / admin123
  Student        nva@fpt.edu.vn   / password

AI advisor: works without a key (rule-based answers). For AI answers, paste a Claude API key
into ANTHROPIC_API_KEY in backend/.env and restart the backend.
`);
