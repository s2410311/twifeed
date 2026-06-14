import { navigate } from "../router.js";
import { renderCard } from "../renderUtils.js";
import { showNav } from "../nav.js";

export function renderSearch() {
    showNav("/search");

    const params     = new URLSearchParams(location.search);
    const q          = params.get("q") ?? "";
    const initialCid = params.get("cid") ? parseInt(params.get("cid")) : null;

    document.getElementById("app").innerHTML = `
        <div class="tw-search-head">
            <a class="tw-header-icon-btn" href="/" data-link title="戻る">←</a>
            <div class="tw-search-wrap">
                <input class="tw-search-input" id="searchInput" type="text"
                    placeholder="キーワード・ユーザー名…"
                    value="${q.replace(/"/g, '&quot;')}">
            </div>
        </div>
        <div class="tw-chips" id="chipRow"></div>
        <p class="tw-search-label" id="searchLabel"></p>
        <div class="tw-page" id="results"></div>
        <button class="tw-more" id="moreBtn" style="display:none">もっと見る</button>
    `;

    let nextOffset = null;
    let currentCid = initialCid;
    const searchInput = document.getElementById("searchInput");

    async function loadCategories() {
        const res = await fetch("/categories");
        if (!res.ok) return;
        const { categories } = await res.json();
        const row = document.getElementById("chipRow");
        for (const c of categories) {
            const btn = document.createElement("button");
            btn.className = "tw-chip" + (c.cid === initialCid ? " active" : "");
            btn.textContent = c.name;
            btn.dataset.cid = c.cid;
            btn.addEventListener("click", () => {
                currentCid = currentCid === c.cid ? null : c.cid;
                row.querySelectorAll(".tw-chip").forEach(b => b.classList.toggle("active", b.dataset.cid == currentCid));
                search(0, false);
            });
            row.appendChild(btn);
        }
    }

    async function search(offset = 0, append = false) {
        const query = searchInput.value.trim();
        if (!query && !currentCid) {
            document.getElementById("results").innerHTML = "";
            document.getElementById("searchLabel").textContent = "";
            return;
        }

        const urlParams = new URLSearchParams();
        if (query) urlParams.set("q", query);
        if (currentCid) urlParams.set("cid", currentCid);
        history.replaceState({}, "", `/search?${urlParams}`);

        const apiParams = new URLSearchParams({ offset, limit: 20 });
        if (query) apiParams.set("q", query);
        if (currentCid) apiParams.set("cid", currentCid);

        const res = await fetch(`/articles/search?${apiParams}`);
        if (res.status === 401) { navigate("/sign"); return; }
        const data = await res.json();

        const container = document.getElementById("results");
        if (!append) container.innerHTML = "";

        const parts = [];
        if (query) parts.push(`「${query}」`);
        if (currentCid) {
            const activeChip = document.querySelector(`.tw-chip[data-cid="${currentCid}"]`);
            if (activeChip) parts.push(activeChip.textContent);
        }
        document.getElementById("searchLabel").textContent =
            parts.length ? `${parts.join(" · ")} の検索結果` : "";

        if (!data.articles.length && !append) {
            container.innerHTML = '<p class="tw-empty">該当する投稿がありませんでした</p>';
        } else {
            data.articles.forEach(a => container.appendChild(renderCard(a)));
        }

        nextOffset = data.next_offset;
        document.getElementById("moreBtn").style.display = nextOffset !== null ? "block" : "none";
    }

    searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") search(0, false); });
    document.getElementById("moreBtn").addEventListener("click", () => search(nextOffset, true));

    loadCategories().then(() => {
        if (q || initialCid) search(0, false);
    });
}
