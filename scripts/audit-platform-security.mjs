#!/usr/bin/env node
/**
 * Static security posture audit for account-bridge platform SaaS.
 *
 * Usage: node scripts/audit-platform-security.mjs
 * Exit 0 = all checks pass.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const failures = [];

function fail(msg) {
  failures.push(msg);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function mustExist(rel, label = rel) {
  if (!fs.existsSync(path.join(ROOT, rel))) fail(`Missing ${label}`);
}

function mustInclude(rel, needle, label) {
  const text = read(rel);
  if (!text.includes(needle)) fail(`${label}: expected "${needle}" in ${rel}`);
}

function mustNotInclude(rel, needle, label) {
  const text = read(rel);
  if (text.includes(needle)) fail(`${label}: "${needle}" must not appear in ${rel}`);
}

// Production demo gate
mustExist('packages/server/src/mountPlatformService.ts');
mustInclude(
  'packages/server/src/mountPlatformService.ts',
  'resolveConsumerUser is required when demoMode is not true',
  'demoMode production gate',
);
mustInclude('packages/server/src/demoConsumerAuth.ts', 'Demo-only consumer identity', 'demo consumer auth doc');
mustInclude('examples/platform-service/server.mjs', "process.env.NODE_ENV === 'production'", 'demo server prod guard');
mustInclude('examples/platform-service/server.mjs', 'demoMode: true', 'demo server demoMode');

// Validation + rate limits
mustExist('packages/platform/src/validation.ts');
mustExist('packages/platform/src/validation.test.ts');
mustExist('packages/server/src/memoryRateLimit.ts');
mustInclude('packages/server/src/mountPlatformService.ts', 'signupLimit', 'signup rate limit');
mustInclude('packages/server/src/mountPlatformService.ts', "jsonBodyLimit ?? '256kb'", 'JSON body limit');

// Tenant auth before routes (health behind middleware)
const mountSrc = read('packages/server/src/mountPlatformService.ts');
const healthIdx = mountSrc.indexOf("router.get('/health'");
const authMiddlewareIdx = mountSrc.indexOf('assertTenantAccess(req, liveApp)');
if (healthIdx === -1 || authMiddlewareIdx === -1 || healthIdx < authMiddlewareIdx) {
  fail('Tenant /health must be registered after tenant credential middleware');
}

// Error sanitization
mustExist('packages/server/src/platformSafeError.ts');
mustInclude('packages/server/src/mountPlatformService.ts', 'platformClientError', 'sanitized client errors');

// Tests
mustExist('packages/server/src/mountPlatformService.test.ts');
mustInclude('packages/server/src/mountPlatformService.test.ts', 'resolveConsumerUser when demoMode is false', 'demoMode test');
mustInclude('packages/server/src/mountPlatformService.test.ts', 'account-wide monthly quota', 'quota test');
mustInclude('packages/server/src/mountPlatformService.test.ts', 'tenant health without publishable key', 'health auth test');
mustInclude('packages/server/src/mountPlatformService.test.ts', 'host A from patching host B', 'host isolation test');

// Docs
mustExist('docs/platform-saas.md');
mustInclude('docs/platform-saas.md', 'Security', 'platform security section');

// Reserved slugs must not block demo seed
mustNotInclude('packages/platform/src/validation.ts', "'saas-demo'", 'saas-demo must not be reserved');

if (failures.length) {
  console.error('[audit-platform-security] FAIL\n');
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}

console.log('[audit-platform-security] ✓ All platform security posture checks passed.');
