import { navigate } from "../router.js";
import { renderCard } from "../renderUtils.js";

export function renderSearch() {
    const params = new URLSearchParams(location.search);
    const q = params.get("q") ?? "";
    const initialCid = params.get("cid") ? parseInt(params.get("cid")) : null;

    document.getElementById("app").innerHTML = `
        <a href="/" data-link>← ホームに戻る</a>
        <hr>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <input id="searchInput" type="text" placeholder="キーワード・ユーザー名…" style="flex:1;min-width:120px;padding:6px;font-size:1em" value="${q.replace(/"/g, '&quot;')}">
            <select id="categorySelect" style="padding:6px;font-size:1em">
                <option value="">カテゴリ（すべて）</option>
            </select>
            <button id="searchBtn">検索</button>
        </div>
        <p id="searchLabel" style="color:#888;font-size:0.9em;margin:6px 0"></p>
        <div id="results"></div>
        <button id="moreBtn" style="display:none;margin-top:8px">もっと見る</button>
    `;

    let nextOffset = null;
    let currentQ = q;
    let currentCid = initialCid;

    const searchInput = document.getElementById("searchInput");
    const categorySelect = document.getElementById("categorySelect");
    const searchLabel = document.getElementById("searchLabel");

    async function loadCategories() {
        const res = await fetch("/categories");
        if (!res.ok) return;
        const { categories } = await res.json();
        for (const c of categories) {
            const opt = document.createElement("option");
            opt.value = c.cid;
            opt.textContent = c.name;
            if (c.cid === initialCid) opt.selected = true;
            categorySelect.appendChild(opt);
        }
    }

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
        const cid = categorySelect.value ? parseInt(categorySelect.value) : null;

        if (!query && !cid) return;

        currentQ = query;
        currentCid = cid;

        const urlParams = new URLSearchParams();
        if (query) urlParams.set("q", query);
        if (cid) urlParams.set("cid", cid);
        history.replaceState({}, "", `/search?${urlParams}`);

        const apiParams = new URLSearchParams({ offset, limit: 20 });
        if (query) apiParams.set("q", query);
        if (cid) apiParams.set("cid", cid);

        const res = await fetch(`/articles/search?${apiParams}`);
        if (res.status === 401) { navigate("/sign"); return; }
        const data = await res.json();

        const container = document.getElementById("results");
        if (!append) container.innerHTML = "";

        const labelParts = [];
        if (query) labelParts.push(`「${query}」`);
        if (cid) {
            const opt = categorySelect.options[categorySelect.selectedIndex];
            labelParts.push(`カテゴリ: ${opt.textContent}`);
        }
        searchLabel.textContent = labelParts.length ? `${labelParts.join(" / ")} の検索結果` : "";

        if (data.articles.length === 0 && !append) {
            container.textContent = "該当する投稿がありませんでした";
        } else {
            data.articles.forEach(a => container.appendChild(renderArticle(a)));
        }

        nextOffset = data.next_offset;
        document.getElementById("moreBtn").style.display = nextOffset !== null ? "inline" : "none";
    }

    document.getElementById("searchBtn").addEventListener("click", () => search(0, false));
    searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") search(0, false); });
    categorySelect.addEventListener("change", () => search(0, false));
    document.getElementById("moreBtn").addEventListener("click", () => search(nextOffset, true));

    loadCategories().then(() => {
        if (q || initialCid) search(0, false);
    });
}
