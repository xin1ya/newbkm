# ART-003 · 萌芽群岛宝可梦清单与制作排期

来源：主控文档 §1 首批区域图鉴 + `src/config/encounters/sprout.ts`（实际出现的野生宝可梦）+ 馆主沧澜队伍 + 进化线补全。
共 **40 种**（S 档 12 种 / A 档 28 种）。规格见 [`model-spec.md`](./model-spec.md)。

**状态列**：建模 → 绑骨 → 动画 → 入库（压缩 + 放进样张页验收 + 注册 manifest）。⬜ 未开始 / 🟨 进行中 / ✅ 完成。
**优先级**：P0 御三家初始形态（M1 能选御三家）；P1 1 号路、湖畔、道馆 1 必需；P2 常见进化与稀有；P3 后期进化与道具进化。
**工时**（人日，含绑骨与动画）：S 档初始形态 5、S 档进化形态 4（复用骨骼模板）；A 档初始形态 3、A 档进化形态 2。

## 汇总

| 优先级 | 数量 | 排期 |
|---|---|---|
| P0 | 3 | M1 第1–3周 |
| P1 | 11 | M1 第3–7周 |
| P2 | 9 | M1 第7–10周 |
| P3 | 17 | M2 前半 |

合计约 **119 人日**（S 52 / A 67）。未完成的模型用 ENG-008 灰模占位，游戏逻辑不受影响。

## 宝可梦

| 编号 | 中文名 | 英文名 | 属性 | 档 | 出现位置 / 获取 | 优先级 | 排期 | 人日 | 建模 | 绑骨 | 动画 | 入库 | 负责人 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 155 | 火球鼠 | Cyndaquil | fire | S | 御三家 | P0 | M1 第1–3周 | 5 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 258 | 水跃鱼 | Mudkip | water | S | 御三家；湖畔雨天稀有 | P0 | M1 第1–3周 | 5 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 722 | 木木枭 | Rowlet | grass/flying | S | 御三家；森林夜间稀有 | P0 | M1 第1–3周 | 5 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 010 | 绿毛虫 | Caterpie | bug | A | 1号路/幻影之森 | P1 | M1 第3–7周 | 3 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 016 | 波波 | Pidgey | normal/flying | A | 1号路/港湾崖/白天 | P1 | M1 第3–7周 | 3 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 019 | 小拉达 | Rattata | normal | A | 1号路/各地夜间 | P1 | M1 第3–7周 | 3 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 025 | 皮卡丘 | Pikachu | electric | A | 1号路稀有/湖畔雨天 | P1 | M1 第3–7周 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 043 | 走路草 | Oddish | grass/poison | A | 1号路夜/湖畔/森林 | P1 | M1 第3–7周 | 3 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 060 | 蚊香蝌蚪 | Poliwag | water | A | 湖畔 | P1 | M1 第3–7周 | 3 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 098 | 大钳蟹 | Krabby | water | A | 湖畔/港湾崖；馆主沧澜 | P1 | M1 第3–7周 | 3 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 120 | 海星星 | Staryu | water | A | 港湾崖夜/海路；馆主沧澜 | P1 | M1 第3–7周 | 3 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 129 | 鲤鱼王 | Magikarp | water | A | 湖畔/钓鱼/海路 | P1 | M1 第3–7周 | 3 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 130 | 暴鲤龙 | Gyarados | water/flying | S | 进化；馆主沧澜王牌 | P1 | M1 第3–7周 | 4 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 570 | 索罗亚 | Zorua | dark | S | 幻影之森剧情/雾天稀有 | P1 | M1 第3–7周 | 5 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 011 | 铁甲蛹 | Metapod | bug | A | 湖畔/森林 | P2 | M1 第7–10周 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 017 | 比比鸟 | Pidgeotto | normal/flying | A | 港湾崖稀有 | P2 | M1 第7–10周 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 072 | 玛瑙水母 | Tentacool | water/poison | A | 海路1 | P2 | M1 第7–10周 | 3 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 121 | 宝石海星 | Starmie | water/psychic | A | 水之石 | P2 | M1 第7–10周 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 156 | 火岩鼠 | Quilava | fire | S | 进化 | P2 | M1 第7–10周 | 4 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 172 | 皮丘 | Pichu | electric | A | 1号路稀有（晴） | P2 | M1 第7–10周 | 3 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 259 | 沼跃鱼 | Marshtomp | water/ground | S | 进化 | P2 | M1 第7–10周 | 4 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 278 | 长翅鸥 | Wingull | water/flying | A | 港湾崖/海路 | P2 | M1 第7–10周 | 3 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 723 | 投羽枭 | Dartrix | grass/flying | S | 进化 | P2 | M1 第7–10周 | 4 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 012 | 巴大蝶 | Butterfree | bug/flying | A | 进化 | P3 | M2 前半 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 018 | 大比鸟 | Pidgeot | normal/flying | A | 进化 | P3 | M2 前半 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 020 | 拉达 | Raticate | normal | A |  | P3 | M2 前半 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 026 | 雷丘 | Raichu | electric | A | 雷之石 | P3 | M2 前半 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 044 | 臭臭花 | Gloom | grass/poison | A | 进化 | P3 | M2 前半 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 045 | 霸王花 | Vileplume | grass/poison | A | 叶之石 | P3 | M2 前半 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 061 | 蚊香君 | Poliwhirl | water | A | 进化 | P3 | M2 前半 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 062 | 蚊香泳士 | Poliwrath | water/fighting | A | 水之石 | P3 | M2 前半 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 073 | 毒刺水母 | Tentacruel | water/poison | A | 进化 | P3 | M2 前半 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 099 | 巨钳蟹 | Kingler | water | A | 进化 | P3 | M2 前半 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 157 | 火暴兽 | Typhlosion | fire | S | 进化 | P3 | M2 前半 | 4 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 182 | 美丽花 | Bellossom | grass | A | 日之石 | P3 | M2 前半 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 186 | 蚊香蛙皇 | Politoed | water | A | 通信交换 | P3 | M2 前半 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 260 | 巨沼怪 | Swampert | water/ground | S | 进化 | P3 | M2 前半 | 4 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 279 | 大嘴鸥 | Pelipper | water/flying | A | 进化 | P3 | M2 前半 | 2 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 571 | 索罗亚克 | Zoroark | dark | S | 进化 | P3 | M2 前半 | 4 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |
| 724 | 狙射树枭 | Decidueye | grass/ghost | S | 进化 | P3 | M2 前半 | 4 | ✅ | ✅ | ✅ | ✅ | Blender 脚本（kit.py + model.py） |

## 人物（萌芽群岛）

| id | 角色 | 档 | 优先级 | 人日 | 建模 | 绑骨 | 动画 | 入库 | 负责人 |
|---|---|---|---|---|---|---|---|---|---|
| player-m / player-f | 玩家（男 / 女） | 人物 1024 | P0 | 6 | 🟨 程序化临时模型（TrainerModel.ts） | ⬜ | ⬜ | ⬜ | |
| magnolia | 木兰博士 | 人物 1024 | P0 | 4 | ⬜ | ⬜ | ⬜ | ⬜ | |
| canglan | 馆主沧澜（水系） | 人物 1024 | P1 | 4 | ⬜ | ⬜ | ⬜ | ⬜ | |
| rival | 劲敌 | 人物 1024 | P1 | 4 | ⬜ | ⬜ | ⬜ | ⬜ | |
| elder-pu | 蒲婆婆 | NPC 512 | P2 | 2 | ⬜ | ⬜ | ⬜ | ⬜ | |
| npc-generic ×6 | 通用 NPC（渔夫、少年、水手、店员、护士、登山者），换色复用 | NPC 512 | P2 | 6 | ⬜ | ⬜ | ⬜ | ⬜ | |

## M3 · 开源底模转换（ADR 0010；来源 rcghpge/pokemon-3d，`art-source/tools/ossconv.py` 重绑骨 + Toon 色阶）

| 编号 | 英文名 | 体型 plan | 来源 | 入库 | 备注 |
|---|---|---|---|---|---|
| 001 | bulbasaur | quadruped | oss:pokemon-3d/1.glb | ✅ |  |
| 002 | ivysaur | quadruped | oss:pokemon-3d/2.glb | ✅ |  |
| 003 | venusaur | quadruped | oss:pokemon-3d/3.glb | ✅ |  |
| 063 | abra | biped | oss:pokemon-3d/63.glb | ✅ |  |
| 064 | kadabra | biped | oss:pokemon-3d/64.glb | ✅ |  |
| 065 | alakazam | biped | oss:pokemon-3d/65.glb | ✅ |  |
| 081 | magnemite | rigid | oss:pokemon-3d/81.glb | ✅ |  |
| 082 | magneton | rigid | oss:pokemon-3d/82.glb | ✅ |  |
| 086 | seel | fish | oss:pokemon-3d/86.glb | ✅ |  |
| 087 | dewgong | fish | oss:pokemon-3d/87.glb | ✅ |  |
| 100 | voltorb | rigid | oss:pokemon-3d/100.glb | ✅ |  |
| 101 | electrode | rigid | oss:pokemon-3d/101.glb | ✅ |  |
| 116 | horsea | fish | oss:pokemon-3d/116.glb | ✅ |  |
| 117 | seadra | fish | oss:pokemon-3d/117.glb | ✅ |  |
| 125 | electabuzz | biped | oss:pokemon-3d/125.glb | ✅ |  |
| 147 | dratini | serpent | oss:pokemon-3d/147.glb | ✅ |  |
| 148 | dragonair | serpent | oss:pokemon-3d/148.glb | ✅ |  |
| 149 | dragonite | biped | oss:pokemon-3d/149.glb | ✅ |  |
| 170 | chinchou | fish | oss:pokemon-3d/170.glb | ✅ |  |
| 171 | lanturn | fish | oss:pokemon-3d/171.glb | ✅ |  |
| 177 | natu | bird | oss:pokemon-3d/177.glb | ✅ |  |
| 178 | xatu | rigid | oss:pokemon-3d/178.glb | ✅ |  |
| 179 | mareep | quadruped | oss:pokemon-3d/179.glb | ✅ |  |
| 180 | flaaffy | biped | oss:pokemon-3d/180.glb | ✅ |  |
| 181 | ampharos | biped | oss:pokemon-3d/181.glb | ✅ |  |
| 200 | misdreavus | rigid | oss:pokemon-3d/200.glb | ✅ |  |
| 215 | sneasel | biped | oss:pokemon-3d/215.glb | ✅ |  |
| 220 | swinub | quadruped | oss:pokemon-3d/220.glb | ✅ |  |
| 221 | piloswine | quadruped | oss:pokemon-3d/221.glb | ✅ |  |
| 225 | delibird | biped | oss:pokemon-3d/225.glb | ✅ |  |
| 230 | kingdra | fish | oss:pokemon-3d/230.glb | ✅ |  |
| 239 | elekid | biped | oss:pokemon-3d/239.glb | ✅ |  |
| 246 | larvitar | biped | oss:pokemon-3d/246.glb | ✅ |  |
| 247 | pupitar | biped | oss:pokemon-3d/247.glb | ✅ |  |
| 248 | tyranitar | biped | oss:pokemon-3d/248.glb | ✅ |  |
| 280 | ralts | biped | oss:pokemon-3d/280.glb | ✅ |  |
| 281 | kirlia | biped | oss:pokemon-3d/281.glb | ✅ |  |
| 282 | gardevoir | biped | oss:pokemon-3d/282.glb | ✅ |  |
| 299 | nosepass | rigid | oss:pokemon-3d/299.glb | ✅ |  |
| 355 | duskull | rigid | oss:pokemon-3d/355.glb | ✅ |  |
| 356 | dusclops | biped | oss:pokemon-3d/356.glb | ✅ |  |
| 361 | snorunt | rigid | oss:pokemon-3d/361.glb | ✅ |  |
| 362 | glalie | rigid | oss:pokemon-3d/362.glb | ✅ |  |
| 363 | spheal | rigid | oss:pokemon-3d/363.glb | ✅ |  |
| 364 | sealeo | fish | oss:pokemon-3d/364.glb | ✅ |  |
| 365 | walrein | fish | oss:pokemon-3d/365.glb | ✅ |  |
| 403 | shinx | quadruped | oss:pokemon-3d/403.glb | ✅ |  |
| 404 | luxio | quadruped | oss:pokemon-3d/404.glb | ✅ |  |
| 405 | luxray | quadruped | oss:pokemon-3d/405.glb | ✅ |  |
| 425 | drifloon | rigid | oss:pokemon-3d/425.glb | ✅ |  |
| 426 | drifblim | rigid | oss:pokemon-3d/426.glb | ✅ |  |
| 429 | mismagius | rigid | oss:pokemon-3d/429.glb | ✅ |  |
| 443 | gible | biped | oss:pokemon-3d/443.glb | ✅ |  |
| 444 | gabite | biped | oss:pokemon-3d/444.glb | ✅ |  |
| 445 | garchomp | biped | oss:pokemon-3d/445.glb | ✅ |  |
| 459 | snover | biped | oss:pokemon-3d/459.glb | ✅ |  |
| 460 | abomasnow | biped | oss:pokemon-3d/460.glb | ✅ |  |
| 461 | weavile | biped | oss:pokemon-3d/461.glb | ✅ |  |
| 462 | magnezone | rigid | oss:pokemon-3d/462.glb | ✅ |  |
| 466 | electivire | biped | oss:pokemon-3d/466.glb | ✅ |  |
| 473 | mamoswine | quadruped | oss:pokemon-3d/473.glb | ✅ |  |
| 475 | gallade | biped | oss:pokemon-3d/475.glb | ✅ |  |
| 476 | probopass | rigid | oss:pokemon-3d/476.glb | ✅ |  |
| 477 | dusknoir | biped | oss:pokemon-3d/477.glb | ✅ |  |
| 478 | froslass | biped | oss:pokemon-3d/478.glb | ✅ |  |
| 592 | frillish | rigid | oss:pokemon-3d/592.glb | ✅ |  |
| 593 | jellicent | rigid | oss:pokemon-3d/593.glb | ✅ |  |
| 903 | sneasler | biped | oss:pokemon-3d/903.glb | ⬜ | 源模型网格损坏，暂用灰模占位 |

## 更新规则

- 开工前在“负责人”一栏填名字，并把对应状态改为 🟨；入库的 PR 同时更新本表。
- 主控文档 §7 的汇总每周同步一次（数量按“入库 ✅”统计）。
- 新增物种先改 `species.json` / 遭遇表，再在本表加一行。

## 进度记录

- 2026-09-29：P0 御三家完成建模 / 绑骨 / 动画，glb 已导出到 `assets/models/pokemon/`（`722_rowlet` 10 片段含 `fly`、`155_cyndaquil` 9 片段、`258_mudkip` 10 片段含 `swim`），`hitTime` 写在同名 `.meta.json`。
  源文件与分步脚本：`art-source/pokemon/<id>/`（`steps/step1..5`，用 `art-source/tools/bx.py run` 经 blender-mcp 重建）。
  入库剩余：gltf-transform 压缩、样张页三时段验收、注册 manifest（随 M1-21 代码侧 glb 接入完成）。

- 2026-10-04 第二批 45 模型参考相似度验收：44 个全部剪影 IoU ≥0.70（864 豁免），详见 docs/art/similarity-batch2.md。
- 2026-10-06：M3-31 开源底模批量转换 64 个（+001–003），清单 187 个模型；大狃拉 903 源网格损坏未入库。
