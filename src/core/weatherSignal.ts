/**
 * M3-30 · 闪电 → 雷声同步信号（渲染层写、音频层读，避免两层互相依赖）。
 * WeatherFx 每次落雷（非双闪的第二下）把 strikes 加 1，并记下这道闪电离相机的距离；
 * Ambience 发现计数变化后，按距离延迟 0.3–3 s 播放雷声（近雷带炸裂声）。
 */
export const weatherSignal = { strikes: 0, distance: 0 };

export function signalLightning(distance: number): void {
  weatherSignal.strikes++;
  weatherSignal.distance = distance;
}
