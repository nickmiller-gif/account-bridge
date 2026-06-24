#!/usr/bin/env node
/**
 * Walk through vite-demo and capture screenshots for docs/presentations.
 * Prereq: npm run demo (or npm run demo -- --with-proxy)
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEMO_URLS, waitForHttpOk } from './demo-shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'docs', 'demo-screenshots');
const BASE = DEMO_URLS.vite;

async function preflight() {
  await waitForHttpOk(`${DEMO_URLS.wallet}/health`);
  await waitForHttpOk(BASE);
}

async function shot(page, name, fullPage = false) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  console.log(`  ✓ ${name}.png`);
}

async function clickScenario(page, labelPart) {
  await page.getByRole('tab', { name: new RegExp(labelPart, 'i') }).click();
  await page.locator('.host-plugin').waitFor({ state: 'visible', timeout: 15_000 });
}

async function clickEmbedMode(page, mode) {
  await page.getByRole('tab', { name: mode, exact: true }).click();
  await page.locator('.host-plugin').waitFor({ state: 'visible', timeout: 15_000 });
}

async function sendWalletChat(page) {
  await clickEmbedMode(page, 'Chat');
  const textarea = page.locator('textarea[placeholder*="Ask"]').last();
  await textarea.waitFor({ state: 'visible', timeout: 10_000 });
  await textarea.fill('What can Account Bridge do?');
  const send = page.getByRole('button', { name: /^Send$/i }).last();
  await send.click();
  await page.getByText('Demo wallet reply').waitFor({ timeout: 20_000 });
  await page.getByText('Demo wallet reply').scrollIntoViewIfNeeded();
}

async function main() {
  console.log('Preflight: wallet-host + vite-demo…');
  await preflight();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  console.log('Capturing Account Bridge walkthrough screenshots…\n');

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('.host-plugin').waitFor({ state: 'visible', timeout: 15_000 });
  await shot(page, '01-home-byok-scenario');

  await clickScenario(page, '2 · App credits');
  await shot(page, '02-wallet-scenario-selected');

  const appCreditsTab = page.getByRole('button', { name: /app credits/i }).first();
  if (await appCreditsTab.isVisible()) {
    await appCreditsTab.click();
    await page.locator('.host-plugin').waitFor({ state: 'visible' });
    await shot(page, '03-wallet-app-credits-tab');
  }

  await clickEmbedMode(page, 'Chat');
  await shot(page, '04-wallet-chat-mode-empty');

  await sendWalletChat(page);
  await shot(page, '05-wallet-chat-reply', true);

  await clickScenario(page, '4 · Feature gate');
  await clickEmbedMode(page, 'Gate');
  await shot(page, '06-gate-before-connect');

  await clickScenario(page, '3 · Remote host');
  await clickEmbedMode(page, 'Full');
  await shot(page, '07-remote-host-scenario');

  await clickScenario(page, '1 · BYOK');
  await clickEmbedMode(page, 'Full');
  await shot(page, '08-byok-settings-full');

  await clickEmbedMode(page, 'Panel');
  await shot(page, '09-panel-fab-mode');

  await browser.close();
  console.log(`\nDone → ${OUT}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
