// #タグ: 英数字・日本語・アンダースコアを対象
const TAG_PATTERN = /#([a-zA-Z0-9぀-ヿ一-鿿＀-￯_.]+)/gu;

export function extractTags(content) {
    const matches = [...content.matchAll(TAG_PATTERN)];
    const names = matches.map(m => m[1].replace(/\.+$/, "")); // 末尾のドットを除去
    return [...new Set(names.filter(n => n.length > 0))]; // 重複除去
}
