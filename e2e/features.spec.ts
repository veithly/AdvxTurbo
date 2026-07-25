import { test, expect } from '@playwright/test';

// 新功能 E2E：自定义 AI 形象 + 自动铸 NFT + Codex 桌宠包 + 多模式关卡
test('自定义形象 / NFT / 桌宠 / 游戏模式', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // 登录（API 注入 token；UI 登录现为 RainbowKit 钱包签名）
  const lr = await page.request.post('http://localhost:4000/api/auth/login', { data: { email: 'player1@blame.game', password: 'test1234' } });
  const { token } = await lr.json();
  await page.addInitScript((t) => localStorage.setItem('token', t as string), token);
  await page.goto('/office');

  // 创建员工 — 自定义 AI 形象（代码渲染 canvas）
  await page.goto('/create');
  await expect(page.locator('canvas.avatar').first()).toBeVisible();
  await page.getByRole('button', { name: /生成形象|Generate/ }).click();
  // 生成后出现形象来源标签（代码渲染 / AI 生成）
  await expect(page.getByText(/程序化|AI 生成|Procedural|AI generated/).first()).toBeVisible({ timeout: 20000 });

  // 走完创建流程 -> NFT + 桌宠下载
  await page.getByRole('button', { name: /下一步|Next/ }).click();
  await page.getByRole('button', { name: /下一步|Next/ }).click();
  await page.getByRole('button', { name: /获取 Worker Key|Get Worker Key/ }).click();
  // AdventureX 席位确认信 → 确认席位，开始创造
  await page.getByRole('button', { name: /确认席位|开始创造/ }).click();
  await expect(page.getByText(/已在 Injective 铸造身份 NFT|Identity NFT minted/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('link', { name: /下载 Codex 桌宠包|Download Codex/ })).toBeVisible();

  // Arena 选择「深夜冲刺（娱乐赛）」模式并开赛
  await page.goto('/arena');
  await page.getByText(/深夜冲刺|Late-night Sprint/).first().click();
  await page.getByRole('button', { name: /开始匹配|Start matching/ }).click();
  await page.waitForURL(/\/match\//, { timeout: 20000 });
  await expect(page.getByText(/深夜冲刺|Late-night Sprint/).first()).toBeVisible({ timeout: 20000 });
  // 默认 1×，测试时加速到 4×
  await page.getByRole('button', { name: '4×' }).click().catch(() => {});
  // 等待结束并出现冠军 👑（游戏节奏有意放慢，预留更多时间）
  await expect(page.getByText('👑', { exact: false })).toBeVisible({ timeout: 60000 });

  // 忽略 React Router 提示 + 良性资源 404（自定义头像缺失会优雅回退到职业精灵）
  const real = errors.filter((e) => !/React Router Future Flag/.test(e) && !/Failed to load resource/.test(e));
  expect(real, 'console: ' + real.join(' | ')).toEqual([]);
});
