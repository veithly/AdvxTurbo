import { test, expect } from '@playwright/test';

// 新功能 E2E：自定义 AI 形象 + 自动铸 NFT + Codex 桌宠包 + 多模式关卡
test('自定义形象 / NFT / 桌宠 / 游戏模式', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  // 登录
  await page.goto('/auth');
  await page.getByRole('button', { name: /登录|Log in/ }).first().click();
  await page.waitForURL(/\/office/, { timeout: 20000 });

  // 创建员工 — 自定义 AI 形象
  await page.goto('/create');
  const preview = page.locator('.card img.avatar').first();
  const before = await preview.getAttribute('src');
  await page.getByRole('button', { name: /生成形象|Generate/ }).click();
  // 生成后预览应指向 /avatars/
  await expect(preview).toHaveAttribute('src', /\/avatars\//, { timeout: 20000 });
  const after = await preview.getAttribute('src');
  expect(after).not.toEqual(before);

  // 走完创建流程 -> NFT + 桌宠下载
  await page.getByRole('button', { name: /下一步|Next/ }).click();
  await page.getByRole('button', { name: /下一步|Next/ }).click();
  await page.getByRole('button', { name: /获取 Worker Key|Get Worker Key/ }).click();
  await expect(page.getByText(/已在 Injective 铸造身份 NFT|Identity NFT minted/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('link', { name: /下载 Codex 桌宠包|Download Codex/ })).toBeVisible();

  // Arena 选择「抢功之王 / Credit War」模式并开赛
  await page.goto('/arena');
  await page.getByText(/抢功之王|Credit War/).first().click();
  await page.getByRole('button', { name: /开始匹配|Start matching/ }).click();
  await page.waitForURL(/\/match\//, { timeout: 20000 });
  await expect(page.getByText(/抢功之王|Credit War/).first()).toBeVisible({ timeout: 20000 });
  // 等待结束并出现冠军 👑
  await expect(page.getByText('👑', { exact: false })).toBeVisible({ timeout: 30000 });

  // 忽略 React Router 提示 + 良性资源 404（自定义头像缺失会优雅回退到职业精灵）
  const real = errors.filter((e) => !/React Router Future Flag/.test(e) && !/Failed to load resource/.test(e));
  expect(real, 'console: ' + real.join(' | ')).toEqual([]);
});
