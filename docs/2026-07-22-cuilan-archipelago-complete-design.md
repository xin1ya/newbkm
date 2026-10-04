# 翠兰群岛完整化设计文档

**日期**：2026-07-22
**状态**：设计已批准，待实现计划
**前置**：[2026-07-21 垂直切片设计](./2026-07-21-pokemon-sequel-vertical-slice-design.md)
**范围**：将现有 9 镇线性切片扩展为完整翠兰群岛（5 岛 + 16 镇 + 13 道馆），补齐 ~300 种宝可梦资源与 18 种地形瓦片图片，并建立完整任务体系（60 条任务 + 任务日志 UI + 动态文案）。

---

## 1. 概述

在已交付的垂直切片基础上，完成三项扩展：

1. **完整群岛地图**：将现有南北线性 9 镇重组为 5 座岛屿的群岛，新增 7 座城镇、4 条跨海水路、10 个支线地点，岛间靠冲浪/渡船连接。
2. **完整任务体系**：建立结构化任务数据模型 + 任务日志 UI 场景 + NPC/路牌动态文案，共 60 条任务（32 主线 + 28 支线），紧扣翠兰群岛「异变之谜」主线与群岛文化生态。
3. **资源补齐**：扩展 PokeAPI 抓取至 ~300 种宝可梦，引入开源 CC0 瓦片图片替换程序生成的纯色矩形。

### 1.1 与现有系统的关系

- **地图系统**（`src/config/maps.ts`）：现有 30 张地图保留，新增 ~35 张地图（新城镇/水路/支线地点/新道馆内部）。扩展 `MapConfig` 支持新地形瓦片字符。
- **任务系统**：新建 `src/systems/quests.ts`（任务注册表 + 状态推导）与 `src/scenes/QuestScene.ts`（任务日志 UI）。`GameState` 不新增字段——任务状态从现有 `flags` 纯推导。
- **资源**：扩展 `scripts/fetch-data.ts` 的 `SPECIES_IDS`；新增瓦片图片到 `public/assets/tiles/`；改造 `OverworldScene.makeTextures()` 加载瓦片图片。
- **道馆**：`OverworldScene.ts` 的 `leaderConfig` / `badgeByLeader` 扩展新馆主配置。

---

## 2. 群岛地图结构

### 2.1 岛屿总览

| 岛 | 名称 | 城镇数 | 道馆数 | 主题 |
|----|------|--------|--------|------|
| 1 | 萌芽群岛 | 3 | 1 | 起始·水 |
| 2 | 碧潮群岛 | 4 | 3 | 草·岩·火 + 异变遗迹 |
| 3 | 雷鸣群岛 | 4 | 4 | 电·普·冰·飞 |
| 4 | 琉璃群岛 | 3 | 3 | 超能·幽灵·水 + 联盟 |
| 5 | 秘境岛 | 2 | 2(隐藏) | 龙·恶 + 二周目 |

**总计**：16 镇（9 旧 + 7 新），13 道馆（8 必需(联盟门槛) + 3 可选 + 2 隐藏），联盟需 8 枚徽章。

### 2.2 各岛详细布局

#### 岛 1 · 萌芽群岛（3 镇，1 道馆）

| # | 城镇 | 类型 | 道馆 | 说明 |
|----|------|------|------|------|
| 1 | 萌芽镇 | 既有 | 无 | 起始镇，木兰博士研究所 |
| 2 | 翠澜镇 | 既有 | 水系·道馆1 | 馆主沧澜 |
| 3 | 港湾市 🆕 | 新增 | 无 | 港口商业镇，渡船枢纽，大市场+钓鱼点 |

- **路线**：萌芽镇 →1号路→ 翠澜镇 →新路线→ 港湾市
- **支线地点**：幻影之森（索罗亚剧情事件，稀有遇敌）
- **跨海**：港湾市码头 → 水路1（冲浪，海系遇敌）→ 岛2 碧潮镇码头

#### 岛 2 · 碧潮群岛（4 镇，3 道馆）

| # | 城镇 | 类型 | 道馆 | 说明 |
|----|------|------|------|------|
| 4 | 碧潮镇 | 既有 | 草系·道馆2 | 馆主叶岚 |
| 5 | 矿石镇 🆕 | 新增 | 岩石系·道馆3 | 矿洞入口，馆主岩磊 |
| 6 | 火山镇 | 既有 | 火系·道馆4 | 馆主炎棘 |
| 7 | 温泉乡 🆕 | 新增 | 无 | 培育屋+温泉治疗 |

- **路线**：碧潮镇 →2号路→ 矿石镇 →新路线→ 火山镇 →新路线→ 温泉乡
- **主线地点**：异变遗迹（4号路北，需3徽章深入，原初守护者BOSS）
- **支线地点**：碧潮古森（居合斩隐藏区域）、火山洞窟（碎岩/闪光/HM）
- **跨海**：温泉乡码头 → 水路2 → 岛3 雷鸣镇码头

#### 岛 3 · 雷鸣群岛（4 镇，3 道馆）

| # | 城镇 | 类型 | 道馆 | 说明 |
|----|------|------|------|------|
| 8 | 雷鸣镇 | 既有 | 电系·道馆5 | 馆主雷霆 |
| 9 | 晨光镇 | 既有 | 普通系·道馆6 | 馆主晨辉 |
| 10 | 雪原镇 🆕 | 新增 | 冰系·道馆7 | 馆主霜凝 |
| 11 | 云雀镇 | 既有 | 飞行系·道馆8 | 馆主云翎 |

- **路线**：雷鸣镇 →5号路→ 晨光镇 →6号路→ 雪原镇 →新路线→ 云雀镇
- **支线地点**：晶石洞窟（怪力推石解谜+稀有晶石）、古灯塔（支线任务地点）
- **跨海**：云雀镇码头 → 水路3 → 岛4 幻影镇码头

#### 岛 4 · 琉璃群岛（3 镇 + 联盟，2 道馆）

| # | 城镇 | 类型 | 道馆 | 说明 |
|----|------|------|------|------|
| 12 | 幻影镇 | 既有 | 超能系·道馆9 | 馆主幻月 |
| 13 | 幽冥镇 🆕 | 新增 | 幽灵系·道馆10 | 馆主幽魄 |
| 14 | 琉璃镇 | 既有 | 水系·道馆11 | 馆主琉璃 |

- **路线**：幻影镇 →8号路→ 幽冥镇 →新路线→ 琉璃镇 →冠军之路→ 彩幽市/精灵联盟
- **主线地点**：冠军之路（攀瀑/推石/碎岩综合解谜）、彩幽市/精灵联盟（四天王+冠军）
- **支线地点**：暗影洞窟（高等级遇敌+隐藏道具）、秘密基地（自定义基地）
- **跨海**：琉璃镇码头 → 渡船（通关后开放）→ 岛5

#### 岛 5 · 秘境岛（2 镇，二周目）

| # | 城镇 | 类型 | 道馆 | 说明 |
|----|------|------|------|------|
| 15 | 寐龙镇 🆕 | 新增 | 龙系·隐藏道馆12 | 需通关，馆主龙渊 |
| 16 | 月魇镇 🆕 | 新增 | 恶系·隐藏道馆13 | 需特殊条件，馆主魇月 |

- **主线地点**：梦之实验室（阿克罗玛剧情续，梦世界入口床）
- **支线地点**：神兽祭坛（捕捉神兽）、永冻之窟（最终BOSS，黑色酋雷姆）
- **解锁**：通关后阿克罗玛联络，渡船开放

### 2.3 新增城镇清单

| 城镇 | 道馆类型 | 馆主 | 队伍（举例） | 徽章 |
|------|----------|------|-------------|------|
| 港湾市 | 无 | — | — | — |
| 矿石镇 | 岩石 | 岩磊 | 小拳石/大岩蛇/隆隆岩 | 磐岩徽章 |
| 温泉乡 | 无 | — | — | — |
| 雪原镇 | 冰 | 霜凝 | 小山猪/冰鬼护/猛犸猪 | 冰晶徽章 |
| 幽冥镇 | 幽灵 | 幽魄 | 鬼斯/梦妖/耿鬼 | 幽魂徽章 |
| 寐龙镇 | 龙 | 龙渊 | 圆陆鲨/七夕青鸟/快龙 | 龙鳞徽章 |
| 月魇镇 | 恶 | 魇月 | 狃拉/灾兽/班基拉 | 月魇徽章 |

### 2.4 水路与跨海机制

**水路地图**（4 条）：全水瓦片（`~`/`d`），两端码头 warp 连接两岛。面朝水瓦片使用 HM03 冲浪进入。

| 水路 | 连接 | 遇敌特色 |
|------|------|----------|
| 水路1 | 岛1港湾市 ↔ 岛2碧潮镇 | 低等级海系（玛瑙水母/海星星/鲤鱼王） |
| 水路2 | 岛2温泉乡 ↔ 岛3雷鸣镇 | 中等级海系（大钳蟹/蚊香君/暴鲤龙） |
| 水路3 | 岛3云雀镇 ↔ 岛4幻影镇 | 高等级海系（白海狮/宝石海星/暴鲤龙） |
| 渡船 | 岛4琉璃镇 ↔ 岛5秘境岛 | 无遇敌，剧情传送（需通关+船票） |

**三种跨岛方式**：
- **冲浪水路**（岛1↔岛2↔岛3↔岛4）：持有 HM03 冲浪后，面朝水瓦片按交互键进入水路地图，有野生遇敌。首次跨海为主线任务 `main-cross-sea-1/2/3`。
- **渡船快线**（已访问岛屿间）：完成 `main-harbor-ferry` 获得渡船通行证后，可在任意已访问岛屿的码头选择已到达的岛屿直接传送（跳过水路遇敌，QoL 功能）。
- **秘境渡船**（岛4↔岛5）：通关后持秘境船票（`main-colress-call` 奖励），琉璃镇码头触发，直达秘境岛。

### 2.5 新增地图清单（~35 张）

- 新城镇地图 ×7（港湾市/矿石镇/温泉乡/雪原镇/幽冥镇/寐龙镇/月魇镇）
- 新道馆内部 ×5（矿石/雪原/幽冥/寐龙/月魇道馆）
- 新路线 ×5（港湾市-翠澜镇间/矿石镇-火山镇间/温泉乡-火山镇间/雪原镇-云雀镇间/幽冥镇-琉璃镇间）
- 水路 ×4
- 支线地点 ×10（幻影之森/碧潮古森/火山洞窟/晶石洞窟/古灯塔/暗影洞窟/秘密基地/梦之实验室/神兽祭坛/永冻之窟）
- 彩幽市/精灵联盟 ×1
- 冠军之路 ×1

### 2.6 地形瓦片字符扩展

现有 7 种（`.,~,#,=,B,D`）扩展到 18 种：

```
.  浅草地(可走)   :  深草地(可走)   ,  高草丛(可走)   ;  花丛(可走)
~  浅水(阻挡)     d  深水(阻挡,潜水) w  瀑布(阻挡,攀瀑) f  急流(阻挡,冲浪)
#  树木(阻挡)     T  巨木(阻挡)     R  岩壁(阻挡)     B  建筑墙(阻挡)
=  土路(可走)     -  石板路(可走)   +  木桥(可走)     D  门(可走)
s  沙滩(可走)     *  雪地(可走)     r  洞窟地(可走)   k  水晶地(可走)
```

**可走瓦片集更新**：`WALKABLE = {.,:,;,,=,-,+,D,s,*,r,k}`（逗号代表高草丛字符 `,`）。
`KNOWN_CHARS` 扩展至全部 18 种。`validateMaps()` 相应更新。

**岛屿地貌主题**：
- 岛1-2：浅草地 + 沙滩 + 花丛主调
- 岛3：雷鸣镇一带草地，雪原镇一带雪地 + 晶石
- 岛4：石板路 + 深水暗色调
- 洞窟地图：洞窟地 `r` + 水晶 `k` + 岩壁 `R`
- 水路：浅水 `~` + 深水 `d` + 偶尔木桥 `+` 小岛

---

## 3. 任务体系

### 3.1 数据模型

```typescript
// src/systems/quests.ts

type QuestCategory = 'main' | 'side' | 'hidden';
type QuestStatus = 'locked' | 'available' | 'active' | 'completed';

interface QuestObjective {
  id: string;
  text: string;           // "前往翠澜镇挑战馆主沧澜"
  completeFlag: string;   // 完成时置位的 flag
}

interface QuestReward {
  items?: { id: string; qty: number }[];
  money?: number;
  hm?: string;
  pokemon?: number;       // speciesId 赠送
}

interface Quest {
  id: string;
  title: string;
  category: QuestCategory;
  island: string;         // "萌芽群岛" | "碧潮群岛" | ...
  summary: string;
  objectives: QuestObjective[];
  prerequisites: string[]; // quest id 或 flag 名，全部满足才 available
  startNpc?: string;       // 给任务的 NPC id
  startFlag?: string;      // 接任务时置位
  completeFlag: string;    // 全部目标完成时置位
  reward?: QuestReward;
}
```

### 3.2 状态推导（纯函数，从 flags 推导）

```typescript
function questStatus(quest: Quest, flags: Record<string, boolean>): QuestStatus {
  if (flags[quest.completeFlag]) return 'completed';
  if (quest.startFlag && flags[quest.startFlag]) return 'active';
  const prereqMet = quest.prerequisites.every(p => flags[p]);
  return prereqMet ? 'available' : 'locked';
}

function currentObjective(quest: Quest, flags: Record<string, boolean>): QuestObjective | null {
  return quest.objectives.find(o => !flags[o.completeFlag]) ?? null;
}
```

**与现有 flags 无缝融合**：道馆徽章 flag（`badge-verdant` 等）、`starter-chosen`、`anomaly-quelled` 等现有 flag 直接作为任务的 `completeFlag` / `prerequisites`，无需改动 GameState 结构。

### 3.3 任务注册表

`src/systems/quests.ts` 导出 `QUESTS: Quest[]`（60 条），按 `id` 索引。提供查询函数：
- `getAvailableQuests(flags)` — 可接取的任务
- `getActiveQuests(flags)` — 进行中的任务
- `getQuestsByIsland(island, flags)` — 按岛筛选

### 3.4 任务日志 UI（QuestScene）

- **入口**：菜单键（同 PartyScene 模式），叠加场景
- **布局**：左侧任务列表（标题 + 类别色标），右侧详情面板（摘要 + 目标列表 + 奖励）
- **分页**：主线 / 支线（含隐藏）
- **显示规则**：
  - `locked` → 标题显示「???」，详情不显示
  - `available` → 标题正常，详情显示，标注「可接取」
  - `active` → 标题正常，当前目标标 ○，已完成目标标 ✓
  - `completed` → 灰显，全部目标 ✓
- **风格**：圆角半透明面板，与战斗 UI 风格统一

### 3.5 动态 NPC/路牌文案

`NpcDef` 扩展 `dialogByQuest` 字段：

```typescript
interface NpcDef {
  // ...现有字段
  /** 按任务状态切换的对话（优先于 dialogDay/dialogNight） */
  dialogByQuest?: Array<{
    questId: string;
    when: QuestStatus;    // 匹配的任务状态
    dialog: string[];
  }>;
}
```

**对话选择优先级**（`runDialog` 中）：
1. `dialogByQuest`（按数组顺序找首个匹配）→ 2. `dialogNight`/`dialogDay`（按时段）→ 3. `dialog`

### 3.6 主线任务（32 条）· 异变之谜五部曲

#### 第一章 · 萌芽群岛（异变初闻）

| # | 任务 ID | 标题 | 目标 | 奖励 |
|----|---------|------|------|------|
| 1 | main-dream-prelude | 梦境序章 | 听完开场梦境对话 | — |
| 2 | main-get-starter | 木兰博士的托付 | 在研究所选择御三家 | 御三家 |
| 3 | main-gym-verdant | 水之试炼 | 击败翠澜道馆馆主沧澜 | 碧澜徽章+HM03冲浪+TM水之波动 |
| 4 | main-harbor-ferry | 港湾渡船事件 | 前往港湾市，与渡船管理员对话开通航线 | 渡船通行证 |
| 5 | main-cross-sea-1 | 首次跨海 | 使用冲浪穿越水路1抵达碧潮群岛 | — |

#### 第二章 · 碧潮群岛（异变痕迹）

| # | 任务 ID | 标题 | 目标 | 奖励 |
|----|---------|------|------|------|
| 6 | main-gym-azure | 古树低语 | 击败碧潮道馆馆主叶岚 | 绿荫徽章+TM魔法叶 |
| 7 | main-mine-anomaly | 矿洞异变 | 在矿石镇矿洞深处调查异变痕迹 | 异变碎片·赤 |
| 8 | main-gym-ore | 岩之试炼 | 击败矿石道馆馆主岩磊 | 磐岩徽章+TM岩石封 |
| 9 | main-volcano-heat | 地热异常 | 调查火山镇地热增强现象 | 异变碎片·橙 |
| 10 | main-gym-flame | 火之试炼 | 击败碧焰道馆馆主炎棘 | 火焰徽章+TM焚烧殆尽 |
| 11 | main-ruins-seal | 封印真相 | 集齐3徽章后深入异变遗迹 | — |
| 12 | main-ruins-boss | 原初守护者 | 击败遗迹深处的原初守护者 | 异变碎片·紫+HM05碎岩 |
| 13 | main-hot-spring-info | 温泉情报 | 在温泉乡获悉群岛古代文明历史 | — |

#### 第三章 · 雷鸣群岛（文明遗迹）

| # | 任务 ID | 标题 | 目标 | 奖励 |
|----|---------|------|------|------|
| 14 | main-cross-sea-2 | 二度跨海 | 穿越水路2抵达雷鸣群岛 | — |
| 15 | main-gym-thunder | 雷云异变 | 击败雷鸣道馆馆主雷霆 | 雷鸣徽章+TM十万伏特 |
| 16 | main-gym-dawn | 普之试炼 | 击败晨光道馆馆主晨辉 | 天秤徽章+TM假勇敢 |
| 17 | main-snow-ruins | 冰封秘密 | 在雪原镇冰川下发现古代文明遗迹 | 异变碎片·蓝 |
| 18 | main-gym-snow | 冰之试炼 | 击败雪原道馆馆主霜凝 | 冰晶徽章+TM冰冻之风 |
| 19 | main-gym-cloud | 天空异象 | 击败云雀道馆馆主云翎 | 白羽徽章+TM燕返 |

#### 第四章 · 琉璃群岛（异变真相）

| # | 任务 ID | 标题 | 目标 | 奖励 |
|----|---------|------|------|------|
| 20 | main-cross-sea-3 | 三度跨海 | 穿越水路3抵达琉璃群岛 | — |
| 21 | main-gym-mirage | 精神异变 | 击败幻影道馆馆主幻月 | 心灵徽章+TM冥想 |
| 22 | main-ghost-event | 亡魂低吟 | 解决幽冥镇异变亡魂事件 | 异变碎片·幽 |
| 23 | main-gym-ghost | 幽之试炼 | 击败幽冥道馆馆主幽魄 | 幽魂徽章+TM暗影球 |
| 24 | main-gym-lily | 水之试炼·终 | 击败琉璃道馆馆主琉璃 | 雨滴徽章+TM水之波动 |
| 25 | main-victory-road | 冠军之路 | 穿越冠军之路抵达精灵联盟 | HM07登瀑 |
| 26 | main-elite-four | 联盟四天王 | 击败四天王（花月→芙蓉→波妮→源治） | — |
| 27 | main-champion | 冠军之战 | 击败冠军米可利，登顶冠军 | 冠军称号 |

#### 第五章 · 秘境岛（异变终结）

| # | 任务 ID | 标题 | 目标 | 奖励 |
|----|---------|------|------|------|
| 28 | main-colress-call | 阿克罗玛的联络 | 通关后接到阿克罗玛联络，渡船开放 | 秘境船票 |
| 29 | main-gym-dragon | 龙之试炼 | 击败寐龙镇馆主龙渊 | 龙鳞徽章+TM流星 |
| 30 | main-gym-dark | 恶之试炼 | 解锁月魇镇并击败馆主魇月 | 月魇徽章+TM恶之波动 |
| 31 | main-dream-world | 梦世界开启 | 在梦之实验室开启梦世界 | 梦之羽 |
| 32 | main-final-boss | 永冻之窟 | 击败永冻之窟最终BOSS，彻底终结异变 | 异变碎片·全+结局 |

### 3.7 支线任务（28 条）· 群岛文化与生态

#### 萌芽群岛（4 条）

| 任务 ID | 标题 | 概要 | 奖励 |
|---------|------|------|------|
| side-zorua-forest | 幻影之森的索罗亚 | 森林中有人看到伪装成人类的索罗亚，前去调查 | 索罗亚入队 |
| side-fisherman-lost | 港湾失物招领 | 帮港湾市渔民寻回海上遗失的钓具 | 厉害钓竿 |
| side-elder-herbs | 蒲婆婆的药草 | 为萌芽镇蒲婆婆采集岛上特有的药草 ×3 | 解毒药×5 |
| side-fishing-contest | 钓鱼大师之路 | 港湾市钓鱼挑战赛，钓到指定3种宝可梦 | 金色钓竿+奖金2000 |

#### 碧潮群岛（6 条）

| 任务 ID | 标题 | 概要 | 奖励 |
|---------|------|------|------|
| side-forest-child | 碧潮古森迷路童 | 森林深处有个迷路的孩子，护送他回碧潮镇 | 奇迹种子 |
| side-mine-rescue | 矿洞救援 | 矿石镇矿工被困深洞，碎岩救出 | HM06怪力 |
| side-volcano-egg | 火山口的蛋 | 火山深处发现一枚稀有宝可梦蛋，孵化它 | 燃烧虫蛋 |
| side-hot-spring-source | 温泉源头疏通 | 温泉乡的温泉被岩石堵塞，疏通源头 | 温泉免费治疗+火之石 |
| side-ancient-tablet | 古代石板解读 | 矿洞中发现刻有群岛历史的石板，带给木兰博士 | 图鉴升级+5000元 |
| side-anomaly-survivor | 异变幸存者 | 寻访异变当年的3位幸存者，听他们讲述往事 | 异变碎片·回忆 |

#### 雷鸣群岛（6 条）

| 任务 ID | 标题 | 概要 | 奖励 |
|---------|------|------|------|
| side-crystal-treasure | 晶石洞窟寻宝 | 洞窟深处用怪力推开巨石，取得稀有晶石 | 属性石×3 |
| side-lighthouse-ghost | 古灯塔幽灵灯 | 修复古灯塔的灯火，驱散笼罩海港的海雾 | 光之石×2+5000元 |
| side-thunder-observation | 雷云观测站 | 帮雷鸣镇研究员观测异常雷云，记录3次数据 | 雷之石×2 |
| side-ice-sculpture | 雪原冰雕节 | 参加雪原镇冰雕比赛，用冰系招式雕刻 | 不融冰+冰之石 |
| side-frozen-seed | 冻土下的种子 | 冰川下发现远古种子，带回温泉乡培育 | 妙蛙种子入队 |
| side-cloud-mail | 云雀信使 | 用飞行系宝可梦送信到3座不同岛屿 | 经验糖果L+飞之石 |

#### 琉璃群岛（6 条）

| 任务 ID | 标题 | 概要 | 奖励 |
|---------|------|------|------|
| side-shadow-cave | 暗影洞窟探险 | 深入高等级暗影洞窟，击败深处稀有宝可梦 | 黑色眼镜+暗之石 |
| side-spirit-seance | 幽冥降灵会 | 帮幽冥镇降灵师与异变亡魂沟通，平息3个亡魂 | 灵界之纱+怨恨TM |
| side-underwater-temple | 海底神殿 | 在琉璃镇海域潜水发现海底遗迹，解开机关 | HM08潜水+古代护符 |
| side-secret-base | 秘密基地定制 | 收集材料在暗影洞窟建造秘密基地 | 秘密基地开放 |
| side-mirage-prophecy | 幻影预言解读 | 幻影镇超能系宝可梦传递预言，解读3段预言 | 先知之眼+精神TM |
| side-lily-watervein | 琉璃水脉修复 | 修复琉璃镇被异变破坏的水脉 | 水之石×2+心之水滴 |

#### 秘境岛（6 条）

| 任务 ID | 标题 | 概要 | 奖励 |
|---------|------|------|------|
| side-legendary-altar | 神兽祭坛唤醒 | 在神兽祭坛唤醒并捕捉一只神兽 | 神兽入队 |
| side-dream-fragments | 梦世界碎片 | 收集散落在梦世界的5块碎片 | 梦之碎片×5 |
| side-dark-town-unlock | 月魇镇解锁 | 满足隐藏条件解锁月魇镇 | 月魇镇开放 |
| side-pokedex-complete | 群岛图鉴完成 | 完成翠兰群岛图鉴（捕获全部） | 圆形护符 |
| side-anomaly-truth | 原初之力真相 | 收集全部异变碎片，揭示异变完整真相 | 真相之证 |
| side-isle-guardian | 群岛守护者 | 完成全部任务后获得群岛守护者称号 | 守护者之证+金色徽章 |

---

## 4. 资源获取

### 4.1 宝可梦资源扩展（~300 种）

扩展 `scripts/fetch-data.ts` 的 `SPECIES_IDS`，从当前 ~50 种扩展到 ~300 种。按属性覆盖全 18 系，每系 3-5 条进化线。

**按属性补充规划**（新增进化线举例）：

| 属性 | 新增 species id |
|------|----------------|
| 岩石/地面 | 74,75,76, 95, 111,112, 50,51, 104,105, 222 |
| 冰 | 86,87, 220,221,473, 215,461, 363,364,365, 225, 361,362,478 |
| 幽灵 | 92,93,94, 200,429, 353,354, 355,356, 442 |
| 龙 | 147,148,149, 371,372,373, 333,334, 443,444,445, 633,634,635 |
| 恶 | 198,430, 228,229, 359, 261,262, 302 |
| 毒 | 23,24, 41,42,169, 88,89, 109,110 |
| 火 | 37,38, 58,59, 77,78, 126,467, 255,256,257 |
| 水 | 79,80,199, 90,91, 116,117,230, 118,119, 133,134, 320,321 |
| 草 | 69,70,71, 102,103, 114,465, 598,599, 270,271,272 |
| 电 | 81,82,462, 100,101, 125,466, 311,312 |
| 飞行 | 83,84,85, 163,164, 193,472, 276,277 |
| 虫 | 46,47, 48,49, 123,212, 204,205, 214, 265,266,267,269 |
| 超能 | 63,64,65, 96,97, 177,178,196, 280,281,282 |
| 普通 | 113,242, 241, 132, 133, 全伊布进化 134-136,196,197,470,471,700 |
| 格斗 | 66,67,68, 56,57, 236,106,237, 286,287,288 |
| 妖精 | 173,35,36, 174,39,40, 183,184, 209,210, 280,281,282, 546,547, 682,683,684,685, 703 |
| 钢 | 208, 304,305,306, 436,437, 374,375,376,800 |
| 伪神 | 246,247,248 |

**二周目神兽（~25 只）**：144,145,146, 150,151, 243,244,245, 249,250, 382,383,384, 480,481,482, 483,484,487, 488,490,491,492,493, 643,644,646, 716,717

**抓取机制**：重跑 `npm run fetch-data`，幂等跳过已有文件，增量下载新增物种的 species/moves/evolution 数据与 artwork/front/back/shiny/cry 图片。预计新增 ~250 种 × (2 API + 6 图片) ≈ 2000 次请求，150ms 限速下约 5 分钟。

**缺失审计**：route-8/9 已引用 63(凯西)/65(胡地) 但 species.json 可能缺数据，确认补齐 63/64/65 线。

### 4.2 道具扩展

`ITEM_NAMES` 扩展：新增进化石（火之石/水之石/雷之石/叶之石/月之石/太阳之石/暗之石/光之石）、HM 道具图标、经验糖果、各类属性强化道具。重跑脚本增量下载图标到 `public/assets/items/`。

### 4.3 开源瓦片图片

**来源**：Kenney CC0 tileset（Roguelike/RPG pack 或 Tiny Town），下载到 `public/assets/tiles/`。授权安全（CC0），可商用。

**瓦片映射**：18 种地形字符各对应一组图片文件：

```
public/assets/tiles/
  grass-1.png, grass-2.png, grass-3.png     → .  浅草地
  grass-dark-1.png, grass-dark-2.png        → :  深草地
  tall-grass-1.png, tall-grass-2.png        → ,  高草丛
  flowers-1.png, flowers-2.png              → ;  花丛
  water-1.png, water-2.png                  → ~  浅水
  deep-water-1.png, deep-water-2.png        → d  深水
  waterfall-1.png, waterfall-2.png          → w  瀑布
  rapids-1.png                              → f  急流
  tree-1.png, tree-2.png                    → #  树木
  big-tree-1.png                            → T  巨木
  rock-wall-1.png, rock-wall-2.png          → R  岩壁
  building-wall-1.png                       → B  建筑墙
  dirt-path-1.png, dirt-path-2.png          → =  土路
  stone-path-1.png, stone-path-2.png        → -  石板路
  wood-bridge-1.png                         → +  木桥
  door-1.png                                → D  门
  sand-1.png, sand-2.png                    → s  沙滩
  snow-1.png, snow-2.png                    → *  雪地
  cave-floor-1.png, cave-floor-2.png        → r  洞窟地
  crystal-1.png, crystal-2.png              → k  水晶地
```

**视觉变体机制**：每种地形 2-3 个变体图，渲染时按 `(x * 31 + y * 17) % variantCount` 哈希选择变体，避免重复纹理感。

**水瓦片动画**：浅水/深水/瀑布瓦片加入 2 帧波纹动画（Phaser sprite animation，每 500ms 切换）。

### 4.4 渲染改造

`OverworldScene.makeTextures()` 从生成纯色 `Phaser.GameObjects.Graphics` 矩形改为：
1. 在 `PreloadScene` 预加载所有瓦片图片为 texture
2. `renderTiles()` 按字符 + 坐标哈希选择变体图，用 `this.add.image()` 贴图
3. 水瓦片用 animated sprite

**装饰图层**：`MapConfig` 新增可选 `decorations?: Array<{ x: number; y: number; type: string }>`，在基础瓦片上叠加装饰物（路灯/栅栏/岩石/花盆/木牌），不影响碰撞判定。

### 4.5 NPC 角色资源

**来源**：Kenney CC0 character pack（或同源 tileset 配套角色包），下载到 `public/assets/characters/`。授权安全（CC0）。

**当前状态**：`OverworldScene.makeTextures()` 用 `Phaser.GameObjects.Graphics` 程序生成纯色矩形 NPC（圆头+身体色块），无差异，仅靠 `npc.color` 区分。

**改造方案**：
1. 下载 Kenney CC0 角色 sprite sheet（含四向行走帧：up/down/left/right，每向 3 帧 = 12 帧）
2. 按角色类型分类：
   - `npc-generic-m.png` / `npc-generic-f.png` — 通用村民（男/女）
   - `npc-nurse.png` — 宝可梦中心护士
   - `npc-shopkeeper.png` — 商店店员
   - `npc-fisherman.png` — 渔民
   - `npc-elder.png` — 老人
   - `npc-child.png` — 小孩
   - `npc-leader-*.png` — 馆主（按属性配色）
   - `npc-professor.png` — 博士
   - `player.png` — 玩家四向行走帧
3. `NpcDef` 新增 `sprite?: string` 字段指定角色图 key，未指定则回退到 `npc-generic-m`
4. `PreloadScene` 预加载全部角色 sprite sheet
5. `renderNpcs()` 改用 sprite sheet + 行走动画（移动时切换帧，静止时用站立帧）

**角色 sprite 映射**：

```
public/assets/characters/
  player.png                  → 玩家（四向 × 3 帧）
  npc-generic-m.png           → 通用男村民
  npc-generic-f.png           → 通用女村民
  npc-nurse.png               → 护士
  npc-shopkeeper.png          → 店员
  npc-fisherman.png           → 渔民
  npc-elder.png               → 老人
  npc-child.png               → 小孩
  npc-professor.png           → 木兰博士
  npc-leader-verdant.png      → 馆主沧澜（水系）
  npc-leader-azure.png        → 馆主叶岚（草系）
  ...（13 个馆主各自一张）
```

### 4.6 NPC 名字显示与互动提示

**NPC 名字标签**：
- 每个 NPC 精灵上方显示名字标签（`Phaser.GameObjects.Text`）
- 样式：12px 白色文字 + 半透明黑色背景圆角，`fontFamily: 'Microsoft YaHei'`
- 位置：NPC 精灵上方 4px 偏移
- depth=1.5（高于 NPC 精灵 depth=1，低于玩家 depth=2）
- 始终显示（不随距离切换），确保玩家一眼识别 NPC 身份

**互动按键提示**：
- 玩家移动停止后，检测面朝方向的相邻格是否有可交互对象（NPC / warp 门 / 可砍树 / 可碎岩 / 钓鱼点 / 冲浪点）
- 有可交互对象时，在该对象上方显示按键提示气泡（如「按 Z」或图标）
- 样式：小圆角气泡 + 按键文字，`fontSize: '10px'`，淡入淡出动画
- 玩家移开或转向无可交互方向时，提示消失
- 提示类型区分：
  - NPC →「按 Z 对话」
  - 门/warp →「按 Z 进入」
  - 水面（有钓竿）→「按 F 钓鱼」
  - 水面（有 HM03）→「按 S 冲浪」
  - 可砍树 →「按 C 砍树」
  - 可碎岩 →「按 B 碎岩」
  - 渡船码头 →「按 Z 渡船」

**实现位置**：`OverworldScene.update()` 中，当 `!moving && !dialogOpen && !warping` 时检测面朝格，渲染/更新提示气泡。

---

## 5. 技术集成

### 5.1 新增/修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/systems/quests.ts` | 新增 | 任务注册表 + 状态推导纯函数 |
| `src/scenes/QuestScene.ts` | 新增 | 任务日志 UI 场景 |
| `src/config/quests.ts` | 新增 | 60 条任务数据定义 |
| `src/config/maps.ts` | 修改 | 新增 ~35 张地图，扩展瓦片字符集，WALKABLE/KNOWN_CHARS 更新 |
| `src/scenes/OverworldScene.ts` | 修改 | leaderConfig/badgeByLeader 扩展，makeTextures 改用瓦片图+角色sprite，renderNpcs 加名字标签，update 加互动提示，runDialog 加 dialogByQuest 优先级，trySurf 冲浪，QuestScene 入口 |
| `src/scenes/PreloadScene.ts` | 修改 | 预加载瓦片图片 + 角色 sprite sheet texture |
| `src/systems/game-state.ts` | 不改 | 任务状态从 flags 纯推导，无需新增字段 |
| `scripts/fetch-data.ts` | 修改 | SPECIES_IDS 扩展至 ~300，ITEM_NAMES 扩展 |
| `public/assets/characters/` | 新增 | Kenney CC0 角色 sprite sheet（~20 张） |
| `tests/quests.test.ts` | 新增 | 任务状态推导单测 |
| `tests/maps.test.ts` | 修改 | 新地图校验、新瓦片字符 |

### 5.2 道馆扩展

`OverworldScene.ts` 的 `leaderConfig` 新增 5 个馆主配置（矿石/雪原/幽冥/寐龙/月魇），`badgeByLeader` 新增 5 个映射。新馆主队伍使用新抓取的宝可梦 species。

### 5.3 冲浪/渡船机制

- **冲浪**：玩家面朝 `~`/`f` 瓦片且有 HM03 时按交互键 → warp 到水路地图。复用现有 warp 机制（`requiresFlag` 检查 `hm03-surf` flag）。
- **渡船**：通关后港湾市/琉璃镇码头 NPC 触发，`requiresFlag: 'champion'` 检查，直接 warp 到秘境岛码头。

### 5.4 测试策略

- **单元测试**：任务状态推导（locked/available/active/completed）、新瓦片字符校验、新地图 validateMaps
- **集成测试**：道馆挑战→徽章→任务完成联动；冲浪进入水路；跨岛 warp 链路
- **手动 QA**：萌芽镇→全岛环游→联盟通关→秘境岛二周目全流程

---

## 6. 范围边界

### 6.1 本期做
- 5 岛 16 镇 13 道馆完整地图（~35 张新地图）
- 60 条任务 + 任务日志 UI + 动态文案
- ~300 种宝可梦资源抓取
- 18 种地形瓦片图片集成
- 4 条跨海水路 + 渡船
- 10 个支线地点
- 二周目秘境岛基础内容

