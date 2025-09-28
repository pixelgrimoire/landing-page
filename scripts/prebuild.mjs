#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

try {
  const res = spawnSync('npx', ['prisma', 'generate'], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  if (res.status !== 0) {
    console.warn('\n[prebuild] prisma generate failed — continuing build (warnings ignored).');
  }
} catch (e) {
  console.warn('\n[prebuild] Skipping prisma generate due to error:', e?.message || e);
}
process.exit(0);

