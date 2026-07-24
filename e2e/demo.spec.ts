import { test, expect } from '@playwright/test';

// 完整用户操作视频：创建/登录 → 员工中心 → 开始排位 → 比赛回放 → 复盘 → 链上 → Agent Lab
// PRD 57.5 关键 E2E。视频输出在 e2e/artifacts/。
test('完整核心循环 UI 演示 (录制视频)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // 1. Home
  await page.goto('/');
  await expect(page.locator('h1')).toContainText(/抢热点|CATCH THE HOTSPOT/);
  await expect(page.locator('.incident-card').first()).toBeVisible();
  await page.waitForTimeout(600);

  // 2. i18n 切换
  await page.getByRole('button', { name: /^EN$|^中$/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^EN$|^中$/ }).click();

  // 3. 登录 (预填 player1)
  await page.goto('/auth');
  await page.getByRole('button', { name: /登录|Log in/ }).first().click();
  await page.waitForURL(/\/office/, { timeout: 20000 });
  await expect(page.getByText(/我的公司|My Company/)).toBeVisible();
  await page.waitForTimeout(600);

  // 4. 开始排位 -> 比赛回放
  await page.getByRole('button', { name: /开始排位|Start Ranked/ }).click();
  await page.waitForURL(/\/match\//, { timeout: 20000 });
  await expect(page.locator('canvas.office-stage')).toBeVisible();
  // 默认 1×，演示时加速到 4×
  await page.getByRole('button', { name: '4×' }).click().catch(() => {});
  // 观看比赛进行
  await page.waitForTimeout(9000);
  // 结果面板出现背锅者
  await expect(page.getByText(/背锅者|Scapegoat/)).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1200);

  // 菜单导航助手（链接已收进折叠菜单）
  const goMenu = async (name: RegExp) => {
    await page.getByRole('button', { name: /菜单|Menu/ }).click();
    await page.getByRole('link', { name }).click();
  };

  // 5. 排行榜
  await goMenu(/排行榜|Leaderboard/);
  await page.waitForURL(/\/leaderboard/);
  await expect(page.locator('table.tbl')).toBeVisible();
  await page.waitForTimeout(600);

  // 6. 链上金库：faucet
  await goMenu(/链上金库|Chain Vault/);
  await page.waitForURL(/\/chain/);
  await expect(page.getByText(/Injective/).first()).toBeVisible();
  const faucet = page.getByRole('button', { name: /领取测试币|Faucet/ });
  if (await faucet.count()) { await faucet.first().click(); await page.waitForTimeout(800); }
  await page.waitForTimeout(600);

  // 7. 经济：质押 / 通证学
  await goMenu(/经济|Economy/);
  await page.waitForURL(/\/economy/);
  await expect(page.getByText(/通证学|Tokenomics/).first()).toBeVisible();
  await page.waitForTimeout(600);

  // 8. Agent Lab: Quick Sim
  await goMenu(/Agent Lab/);
  await page.waitForURL(/\/lab/);
  await expect(page.locator('textarea')).toBeVisible();
  await page.getByRole('button', { name: /Quick Sim/ }).click();
  await expect(page.locator('table.tbl')).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1000);

  // 9. Docs
  await goMenu(/Agent 指南|Agent Guide/);
  await page.waitForURL(/\/docs/);
  await expect(page.locator('table.tbl')).toBeVisible();

  // 允许 React Router 未来标志警告，但不允许其它错误
  const real = errors.filter((e) => !/React Router Future Flag/.test(e));
  expect(real, 'console errors: ' + real.join(' | ')).toEqual([]);
});
