// required(lv) = floor(lv³ × 0.8) — ポケモン中速グループ準拠
export function levelToExp(lv) {
    return Math.floor(Math.pow(lv, 3) * 0.8);
}

export function expToLevel(exp) {
    let lv = 1;
    while (levelToExp(lv + 1) <= exp) lv++;
    return lv;
}
