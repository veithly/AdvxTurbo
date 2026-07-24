# 《谁来背锅？》8-bit 像素素材包

本包所有元素均为独立 PNG，不使用拼图或整页素材表。

## 目录

- `characters/`：512×512 透明角色图
- `props/`：256×256 透明道具图
- `backgrounds/`：1280×720 独立背景图
- `icons/`：256×256 透明操作图标
- `vfx/`：384×384 透明技能与事件特效
- `native/`：对应的游戏原始像素尺寸

## 像素规范

- 角色原始网格：64×64
- 道具与操作图标：32×32
- 特效：48×48
- 背景：160×90，16:9
- 放大版本全部使用 nearest-neighbor，不使用抗锯齿

## 引擎导入

- Unity：Filter Mode 设为 `Point (no filter)`，关闭 Mip Maps，Compression 设为 None。
- Godot：关闭纹理 Filter，启用整数倍缩放。
- Web/CSS：使用 `image-rendering: pixelated`。
