import { renderCard, escapeHtml } from "./renderUtils.js";

const tagName = new URLSearchParams(location.search).get("name") ?? "";
let nextOffset = null;

document.getElementById("tagTitle").textContent = `#${tagName}`;
document.title = `#${tagName} - twifeed`;

async function load(offset = 0, append = false) {
    const res = await fetch(`/tags/${encodeURIComponent(tagName)}/articles?offset=${offset}&limit=20`);
    if (res.status === 401) { window.location.href = "/sign.html"; return; }

    const data = await res.json();
    const container = document.getElementById("timeline");
    if (!append) container.innerHTML = "";

    if (data.articles.length === 0 && !append) {
        container.textContent = "投稿がありません";
    }

    for (const a of data.articles) {
        const card = renderCard(a);
        const link = document.createElement("a");
        link.href = `/article.html?aid=${a.aid}`;
        link.textContent = "詳細";
        link.style.fontSize = "0.85em";
        link.style.marginLeft = "8px";
        card.appendChild(link);
        container.appendChild(card);
    }

    nextOffset = data.next_offset;
    document.getElementById("moreBtn").style.display = nextOffset !== null ? "inline" : "none";
}

document.getElementById("moreBtn").addEventListener("click", () => load(nextOffset, true));

load();
