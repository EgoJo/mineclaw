# 深圳像素城市 · 设计理念

## 方案一：赛博霓虹像素风

<response>
<text>
**Design Movement**: 赛博朋克像素艺术（Cyberpunk Pixel Art）
**Core Principles**:
- 深色底板 + 高饱和霓虹色作为点缀，强调信息密度
- 像素字体与现代 sans-serif 混搭，制造时代错位感
- 数据可视化优先，所有信息用像素化图表呈现
- 动态感强：扫描线、闪烁、流动粒子

**Color Philosophy**: 深夜深圳的感觉——`#0a0a12` 极深蓝黑底，`#00f5ff` 青色霓虹、`#ff2d78` 粉红霓虹、`#ffd700` 金色点缀。情绪色：绿=开心、红=愤怒、蓝=孤独。

**Layout Paradigm**: 左侧 55% 为像素地图画布（Canvas），右侧 45% 为垂直堆叠的信息面板。顶部 48px 横幅显示时间、天气、新闻滚动条。

**Signature Elements**:
- 扫描线叠加层（CSS repeating-linear-gradient）
- 像素化 Bot 头像（8x8 像素点阵）
- 地点之间的霓虹连线动画

**Interaction Philosophy**: 点击地点高亮该地点的所有 Bot；点击 Bot 卡片弹出详情抽屉；悬停显示 tooltip 气泡。

**Animation**: Canvas 上 Bot 头像平滑移动（lerp 插值）；情绪变化时头像边框颜色渐变；睡眠时头像轻微上下浮动。

**Typography System**: 标题用 `Press Start 2P`（像素字体），数据标签用 `JetBrains Mono`，正文用 `Noto Sans SC`。
</text>
<probability>0.08</probability>
</response>

## 方案二：复古电子游戏地图风

<response>
<text>
**Design Movement**: 复古 RPG 俯视地图（Retro RPG Top-Down Map）
**Core Principles**:
- 模拟 Game Boy / SNES 时代的 16 色调色板
- 地图采用等轴测（isometric）风格
- 信息面板模拟 RPG 状态栏

**Color Philosophy**: `#1a1c2c` 深蓝底，`#5d275d` 紫色、`#b13e53` 红色、`#ef7d57` 橙色、`#ffcd75` 黄色——完全复刻 PICO-8 调色板。

**Layout Paradigm**: 全屏地图，右侧浮动半透明 HUD 面板。

**Signature Elements**: 像素树、像素建筑、像素路灯；Bot 用 RPG 角色精灵表示。

**Animation**: 角色行走动画（4帧循环）；地图卷轴滚动。

**Typography System**: 全部使用 `Press Start 2P`，营造完全的复古游戏感。
</text>
<probability>0.07</probability>
</response>

## 方案三：监控室 · 城市运营中心风（选定）

<response>
<text>
**Design Movement**: 城市运营中心（City Operations Center / NOC Dashboard）
**Core Principles**:
- 信息密度极高，模拟真实城市监控大屏
- 像素地图作为核心视觉，但 UI 框架现代、专业
- 数据流动感：实时更新、数字跳动、状态变化有动效
- 深色沉浸式体验，让用户感觉在"监视"这座城市

**Color Philosophy**: `#060b14` 极深海军蓝底；`#1a2744` 面板背景；`#4d96ff` 主蓝色（科技感）；`#6bcb77` 绿色（正常/开心）；`#ff6b6b` 红色（危险/愤怒）；`#ffd93d` 黄色（警告/焦虑）；`#c77dff` 紫色（孤独/欲望）。

**Layout Paradigm**: 
- 顶部 Header：时间 + 天气 + 新闻滚动条 + 全局统计
- 左侧 60%：像素城市地图（Canvas，可缩放）
- 右侧 40%：上半部分 Bot 状态卡片网格，下半部分标签页（事件流/朋友圈/详情）

**Signature Elements**:
- 像素地图上的地点用发光圆圈标记，Bot 用彩色像素头像表示
- 面板边框用细线 + 角标装饰（科技感边框）
- 情绪雷达图（小型 radar chart）

**Interaction Philosophy**: 点击 Bot 卡片 → 右侧切换到该 Bot 详情；点击地图地点 → 高亮该地点所有 Bot；右侧面板标签页切换不同信息维度。

**Animation**: Bot 在地图上位置变化时平滑过渡（CSS transition）；数字变化时有短暂高亮；新事件出现时从底部滑入。

**Typography System**: 标题用 `Orbitron`（科技感），数据用 `JetBrains Mono`（等宽，适合数字），中文正文用 `Noto Sans SC`。
</text>
<probability>0.09</probability>
</response>

---

## 选定方案：方案三 · 城市运营中心风

选择理由：最能体现"监视深圳"的沉浸感，信息密度高，与 world_engine 的数据结构完美契合，像素地图作为视觉核心，同时保持现代 Dashboard 的可读性。
