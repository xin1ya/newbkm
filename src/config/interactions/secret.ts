/**
 * M4-02 · 秘境岛场景互动（渡船）。
 * 船票条件由 story 侧的 SECRET_FERRY_TICKET 门控在琉璃镇码头交互上；这里码头回程随时可坐。
 */
import type { InteractionDef } from '@/systems/interaction';

export const SECRET_LANDMARKS: InteractionDef[] = [
  {
    id: 'secret-dock',
    kind: 'ferry',
    range: 4,
    pages: ['秘境岛码头。', '「开往琉璃镇的渡船：每日往返。」', '系缆桩旁钉着一块褪色的木牌：「入夜后峡谷有风，请早些回镇。」'],
    effects: [{ kind: 'story', script: 'ferry-to-glaze' }],
  },
];
