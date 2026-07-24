# 音频资源制作 / Audio Production

《谁来背锅？》的音频分两部分：**短音效（脚本生成，已就绪）** 与 **长篇背景音乐（MiniMax 生成，可选升级）**。

## 1. 短音效 SFX（已实现，零依赖）

```bash
npm run sfx          # 运行 scripts/generate-sfx.mjs
```

生成到 `assets_audio/sfx/*.wav`（10 个 8-bit 音效）与 `assets_audio/bgm/office_theme.wav`（约 24 秒可循环程序化 chiptune BGM，作为默认背景音乐）。服务器通过 `/audio` 静态路径提供。

音效清单：`click / success / error / match_start / ship / explosion / alert / fix / coffee / blame`
分别用于：按钮点击、发布成功、错误、匹配开始、上线、P0 爆炸、事件报警、修复 Bug、喝咖啡、背锅结算。

## 2. 长篇背景音乐（MiniMax，通过 kimi-webbridge）

PRD 要求使用 [MiniMax 音乐生成](https://www.minimaxi.com/audio/music) 制作长篇（1–3 分钟）游戏 BGM。因为这需要在 MiniMax 网站上使用**你本人已登录的账号**，故作为可选升级步骤，用 `kimi-webbridge` 技能在你的真实浏览器中完成：

### 步骤

1. 确保 kimi-webbridge daemon 已启动且浏览器已登录 minimaxi.com。
2. 让 Agent 执行 kimi-webbridge，导航到 `https://www.minimaxi.com/audio/music`。
3. 使用以下 **Prompt / 歌词** 生成两段主题曲：

**主题 A — 办公室日常（Sprint 阶段，轻快）**
```
Style: upbeat 8-bit chiptune, playful corporate office comedy, 130 BPM, looping, NES-style square lead + triangle bass, light shaker
Mood: busy, mischievous, "everyone is pretending to work"
Length: 90s, seamless loop
```

**主题 B — 线上事故（Incident/Freeze 阶段，紧张）**
```
Style: tense 8-bit chiptune, ticking clock, rising arpeggio, alarm motif, 150 BPM, minor key
Mood: production is on fire, boss is coming, someone will take the blame
Length: 60s, seamless loop
```

4. 下载生成的音频（mp3/wav），重命名并放入：
   - `assets_audio/bgm/office_theme.wav`（替换程序化版本，主题 A）
   - `assets_audio/bgm/incident_theme.wav`（主题 B，可选）
5. 前端 `src/audio.ts` 的 `playBgm('office_theme')` 会自动使用新文件；如需事故主题，在 `MatchView` 进入 `incident` 阶段时调用 `playBgm('incident_theme')`。

> 说明：本仓库默认已内置**程序化生成的 `office_theme.wav`**，游戏开箱即用；MiniMax 长音乐为可选的质量升级，不影响任何功能跑通。
