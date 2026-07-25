import { test, expect } from '@playwright/test';

// 完整用户操作视频：创建/登录 → 员工中心 → 开始排位 → 比赛回放 → 复盘 → 链上 → Agent Lab
// PRD 57.5 关键 E2E。视频输出在 e2e/artifacts/。
test('完整核心循环 UI 演示 (录制视频)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // 登录改为 API 注入 token（UI 登录现在只有 RainbowKit 钱包签名，无法在无头浏览器里走）
  const lr = await page.request.post('http://localhost:4000/api/auth/login', { data: { email: 'player1@blame.game', password: 'test1234' } });
  const { token } = await lr.json();
  await page.addInitScript((t) => localStorage.setItem('token', t as string), token);

  // 1. Home
  await page.goto('/');
  await expect(page.locator('h1')).toContainText(/Advx|ADVX/);
  await expect(page.locator('.incident-card').first()).toBeVisible();
  await page.waitForTimeout(600);

  // 2. i18n 切换
  await page.getByRole('button', { name: /^EN$|^中$/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^EN$|^中$/ }).click();

  // 3. 已通过 token 登录，直接进选手中心
  await page.goto('/office');
  await expect(page.getByText(/我的战队|My Squad/)).toBeVisible();
  await page.waitForTimeout(600);

  // 4. 开始排位 -> 比赛回放
  await page.getByRole('button', { name: /开始排位|Start Ranked/ }).click();
  await page.waitForURL(/\/match\//, { timeout: 20000 });
  await expect(page.locator('canvas.office-stage')).toBeVisible();
  // 默认 1×，演示时加速到 4×
  await page.getByRole('button', { name: '4×' }).click().catch(() => {});
  // 观看比赛进行
  await page.waitForTimeout(9000);
  // 结果面板出现本局冠军
  await expect(page.getByText(/冠军|Champion/)).toBeVisible({ timeout: 30000 });
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

  // 7. 商店（装饰品 NFT）：经济/锺标赛页已从菜单精简移除
  await goMenu(/商店|Store/);
  await page.waitForURL(/\/store/);
  await expect(page.getByText(/mint NFT/).first()).toBeVisible();
  await page.waitForTimeout(600);

  // 8. Agent Lab: Quick Sim
  await goMenu(/Agent Lab/);
  await page.waitForURL(/\/lab/);
  // 默认落在「Agent 接入」页，先切到代码编辑
  await page.getByRole('button', { name: /代码编辑|Code Editor/ }).click();
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
