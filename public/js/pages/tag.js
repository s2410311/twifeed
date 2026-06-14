import { navigate } from "../router.js";
import { renderCard, escapeHtml } from "../renderUtils.js";
import { showNav } from "../nav.js";

export function renderTag(tagName) {
    showNav("/search");

    document.getElementById("app").innerHTML = `
        <div class="tw-header">
            <a class="tw-header-icon-btn" href="/" data-link title="戻る">←</a>
            <span class="tw-header-title">#${escapeHtml(tagName)}</span>
        </div>
        <div class="tw-page" id="timeline"></div>
        <button class="tw-more" id="moreBtn" style="display:none">もっと見る</button>
    `;
    document.title = `#${tagName} - TwiFeed`;

    let nextOffset = null;

    async function load(offset = 0, append = false) {
        const res = await fetch(`/tags/${encodeURIComponent(tagName)}/articles?offset=${offset}&limit=20`);
        if (res.status === 401) { navigate("/sign"); return; }
        const data = await res.json();
        const container = document.getElementById("timeline");
        if (!append) container.innerHTML = "";
        if (!data.articles.length && !append) {
            container.innerHTML = '<p class="tw-empty">投稿がありません</p>';
        } else {
            data.articles.forEach(a => container.appendChild(renderCard(a)));
        }
        nextOffset = data.next_offset;
        document.getElementById("moreBtn").style.display = nextOffset !== null ? "block" : "none";
    }

    document.getElementById("moreBtn").addEventListener("click", () => load(nextOffset, true));
    load();
}
