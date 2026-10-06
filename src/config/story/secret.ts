/**
 * M4-02 · 秘境航线（渡船）与秘境岛落地演出。
 *
 * - 联盟夺冠后由阿克罗玛的联络送来「秘境船票」（任务 main-colress-call，M4-10 落地）；
 * - 持票在琉璃镇码头乘渡船直达秘境岛（过场动画、无遇敌），秘境岛码头可返回琉璃镇；
 * - 抵达秘境岛时播放第五章标题卡（secret-arrival）。
 */
import type { StoryScript, StoryStep, StoryTrigger } from '@/systems/story';

const PI = Math.PI;
/** 渡船到达点：秘境岛码头栈桥北端 / 琉璃镇码头前的主街 */
export const SECRET_FERRY_ARRIVAL = {
  secret: { x: 58, z: 502, yaw: PI },
  glaze: { x: 594, z: 152, yaw: -PI / 2 },
} as const;

const ferryToSecret: StoryStep[] = [
  {
    kind: 'choice',
    prompt: '要乘渡船前往秘境岛吗？（航程约半日，中途不停靠）',
    options: [
      {
        label: '出发（秘境岛）',
        steps: [
          { kind: 'say', speaker: '船老大', lines: ['秘境船票……好，上船吧。', '这船是当年异变之后新造的——岛上现在只剩龙和夜了，你自己当心。'] },
          { kind: 'fx', name: 'fade-out', ms: 700 },
          { kind: 'card', title: '琉璃—秘境航线', subtitle: '渡船航行中……', ms: 1800 },
          { kind: 'travel', island: 'secret', x: SECRET_FERRY_ARRIVAL.secret.x, z: SECRET_FERRY_ARRIVAL.secret.z, yaw: SECRET_FERRY_ARRIVAL.secret.yaw },
        ],
      },
      { label: '再等等', steps: [] },
    ],
  },
];

const ferryToGlaze: StoryStep[] = [
  {
    kind: 'choice',
    prompt: '要乘渡船返回琉璃群岛（琉璃镇）吗？',
    options: [
      {
        label: '出发（琉璃镇）',
        steps: [
          { kind: 'say', lines: ['「返回琉璃镇的渡船即将开航，请握好扶手！」'] },
          { kind: 'fx', name: 'fade-out', ms: 700 },
          { kind: 'card', title: '琉璃—秘境航线', subtitle: '渡船航行中……', ms: 1600 },
          { kind: 'travel', island: 'glaze', x: SECRET_FERRY_ARRIVAL.glaze.x, z: SECRET_FERRY_ARRIVAL.glaze.z, yaw: SECRET_FERRY_ARRIVAL.glaze.yaw },
        ],
      },
      { label: '再等等', steps: [] },
    ],
  },
];

const secretArrival: StoryStep[] = [
  { kind: 'card', title: '第五章 · 异变终结', subtitle: '秘境岛', ms: 2600 },
  { kind: 'narrate', lines: ['渡船靠上了长长的石栈桥。', '峡谷深处传来一声悠长的鸣叫，像是应答，又像是警告。'] },
  { kind: 'flag', set: 'secret-arrival-card' },
];

export const SECRET_STORY: StoryScript[] = [
  { id: 'ferry-to-secret', steps: ferryToSecret },
  { id: 'ferry-to-glaze', steps: ferryToGlaze },
  { id: 'secret-arrival', steps: secretArrival },
];

export const SECRET_TRIGGERS: StoryTrigger[] = [
  { id: 'secret-arrival', island: 'secret', position: [58, 516], radius: 26, script: 'secret-arrival', doneFlag: 'secret-arrival-card' },
];
