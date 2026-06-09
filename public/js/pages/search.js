import { navigate } from "../router.js";
import { renderCard } from "../renderUtils.js";

export function renderSearch() {
    const q = new URLSearchParams(location.search).get("q") ?? "";

    document.getElementById("app").innerHTML = `
        <a href="/" data-link>← ホームに戻る</a>
        <hr>
        <div style="display:flex;align-items:center;gap:8px">
            <input id="searchInput" type="text" placeholder="キーワードを入力…" style="flex:1;padding:6px;font-size:1em" value="${q.replace(/"/g, '&quot;')}">
            <button id="searchBtn">検索</button>
        </div>
        <p id="searchLabel" style="color:#888;font-size:0.9em;margin:6px 0"></p>
        <div id="results"></div>
        <button id="moreBtn" style="display:none;margin-top:8px">もっと見る</button>
    `;

    let nextOffset = null;
    let currentQ = q;

    const searchInput = document.getElementById("searchInput");
    const searchLabel = document.getElementById("searchLabel");

    function renderArticle(a) {
        const card = renderCard(a);
        const replyCount = document.createElement("span");
        replyCount.textContent = `💬 ${a.reply_count}`;
        replyCount.style.cssText = "font-size:0.85em;color:#888;margin-left:8px";
        const detailLink = document.createElement("a");
        detailLink.href = `/article/${a.aid}`;
        detailLink.setAttribute("data-link", "");
        detailLink.textContent = "詳細";
        detailLink.style.cssText = "font-size:0.85em;margin-left:8px";
        card.appendChild(replyCount);
        card.appendChild(detailLink);
        return card;
    }

    async function search(offset = 0, append = false) {
        const query = searchInput.value.trim();
        if (!query) return;
        currentQ = query;

        history.replaceState({}, "", `/search?q=${encodeURIComponent(query)}`);

        const res = await fetch(`/articles/search?q=${encodeURIComponent(query)}&offset=${offset}&limit=20`);
        if (res.status === 401) { navigate("/sign"); return; }
        const data = await res.json();

        const container = document.getElementById("results");
        if (!append) container.innerHTML = "";

        if (data.articles.length === 0 && !append) {
            container.textContent = "該当する投稿がありませんでした";
            searchLabel.textContent = `「${query}」の検索結果`;
        } else {
            data.articles.forEach(a => container.appendChild(renderArticle(a)));
            searchLabel.textContent = `「${query}」の検索結果`;
        }

        nextOffset = data.next_offset;
        document.getElementById("moreBtn").style.display = nextOffset !== null ? "inline" : "none";
    }

    document.getElementById("searchBtn").addEventListener("click", () => search(0, false));
    searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") search(0, false); });
    document.getElementById("moreBtn").addEventListener("click", () => search(nextOffset, true));

    if (q) search(0, false);
}
