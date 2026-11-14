// Loads backend/.env into process.env before any module reads configuration.
// Must be the first import in main.ts. Uses Node's built-in loader (Node >= 20.12).
import { existsSync } from 'fs';
import { join } from 'path';

const envPath = join(__dirname, '..', '.env');
const envPathFromDist = join(__dirname, '..', '..', '.env');

for (const p of [envPath, envPathFromDist]) {
  if (existsSync(p)) {
    (process as any).loadEnvFile(p);
    break;
  }
}
