import { navigate } from "../router.js";
import { renderCard, escapeHtml } from "../renderUtils.js";

export function renderTag(tagName) {
    document.getElementById("app").innerHTML = `
        <a href="/" data-link>← ホームに戻る</a>
        <h1>#${escapeHtml(tagName)}</h1>
        <div id="timeline"></div>
        <button id="moreBtn" style="display:none">もっと見る</button>
    `;
    document.title = `#${tagName} - twifeed`;

    let nextOffset = null;

    async function load(offset = 0, append = false) {
        const res = await fetch(`/tags/${encodeURIComponent(tagName)}/articles?offset=${offset}&limit=20`);
        if (res.status === 401) { navigate("/sign"); return; }
        const data = await res.json();
        const container = document.getElementById("timeline");
        if (!append) container.innerHTML = "";
        if (data.articles.length === 0 && !append) { container.textContent = "投稿がありません"; }
        for (const a of data.articles) {
            const card = renderCard(a);
            const link = document.createElement("a");
            link.href = `/article/${a.aid}`;
            link.setAttribute("data-link", "");
            link.textContent   = "詳細";
            link.style.cssText = "font-size:0.85em;margin-left:8px";
            card.appendChild(link);
            container.appendChild(card);
        }
        nextOffset = data.next_offset;
        document.getElementById("moreBtn").style.display = nextOffset !== null ? "inline" : "none";
    }

    document.getElementById("moreBtn").addEventListener("click", () => load(nextOffset, true));
    load();
}
