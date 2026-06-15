import { navigate } from "../router.js";
import { renderCard, escapeHtml } from "../renderUtils.js";
import { showNav } from "../nav.js";

const DEPARTMENTS = [
    "人文・文化学群", "社会・国際学群", "人間学群", "生命環境学群",
    "情報学群", "医学群", "体育専門学群", "芸術専門学群", "総合学域群",
    "教育研究科", "人文社会科学研究科", "ビジネス科学研究科",
    "数理物質科学研究科", "システム情報工学研究科", "生命環境科学研究科",
    "人間総合科学研究科", "図書館情報メディア研究科", "グローバル教育院",
];
const ROLES = ["学生", "教員", "職員"];

export function renderSearch() {
    showNav("/search");

    const params      = new URLSearchParams(location.search);
    const q           = params.get("q") ?? "";
    const initialTab  = params.get("tab") === "users" ? "users" : "posts";
    const initialCid  = params.get("cid") ? parseInt(params.get("cid")) : null;
    const initialDept = params.get("department") ?? null;
    const initialRole = params.get("role") ?? null;

    document.getElementById("app").innerHTML = `
        <div class="tw-search-head">
            <a class="tw-header-icon-btn" href="/" data-link title="戻る">←</a>
            <div class="tw-search-wrap">
                <input class="tw-search-input" id="searchInput" type="text"
                    placeholder="キーワード・ユーザー名…"
                    value="${q.replace(/"/g, '&quot;')}">
            </div>
        </div>
        <div class="tw-tabs">
            <button class="tw-tab${initialTab === 'posts' ? ' active' : ''}" id="tabPosts">投稿</button>
            <button class="tw-tab${initialTab === 'users' ? ' active' : ''}" id="tabUsers">ユーザー</button>
        </div>
        <div class="tw-chips" id="chipRow"></div>
        <p class="tw-search-label" id="searchLabel"></p>
        <div class="tw-page" id="results"></div>
        <button class="tw-more" id="moreBtn" style="display:none">もっと見る</button>
    `;

    let nextOffset = null;
    let currentTab  = initialTab;
    let currentCid  = initialCid;
    let currentDept = initialDept;
    let currentRole = initialRole;
    const searchInput = document.getElementById("searchInput");

    document.getElementById("tabPosts").addEventListener("click", () => {
        if (currentTab === "posts") return;
        currentTab = "posts";
        document.getElementById("tabPosts").classList.add("active");
        document.getElementById("tabUsers").classList.remove("active");
        currentDept = null;
        currentRole = null;
        renderChips().then(() => search(0, false));
    });

    document.getElementById("tabUsers").addEventListener("click", () => {
        if (currentTab === "users") return;
        currentTab = "users";
        document.getElementById("tabUsers").classList.add("active");
        document.getElementById("tabPosts").classList.remove("active");
        currentCid = null;
        renderChips().then(() => search(0, false));
    });

    async function renderChips() {
        const row = document.getElementById("chipRow");
        row.innerHTML = "";

        if (currentTab === "posts") {
            const res = await fetch("/categories");
            if (!res.ok) return;
            const { categories } = await res.json();
            for (const c of categories) {
                const btn = document.createElement("button");
                btn.className = "tw-chip" + (c.cid === currentCid ? " active" : "");
                btn.textContent = c.name;
                btn.dataset.cid = c.cid;
                btn.addEventListener("click", () => {
                    currentCid = currentCid === c.cid ? null : c.cid;
                    row.querySelectorAll("[data-cid]").forEach(b =>
                        b.classList.toggle("active", b.dataset.cid == currentCid));
                    search(0, false);
                });
                row.appendChild(btn);
            }
        } else {
            for (const dept of DEPARTMENTS) {
                const btn = document.createElement("button");
                btn.className = "tw-chip" + (dept === currentDept ? " active" : "");
                btn.textContent = dept;
                btn.dataset.dept = dept;
                btn.addEventListener("click", () => {
                    currentDept = currentDept === dept ? null : dept;
                    row.querySelectorAll("[data-dept]").forEach(b =>
                        b.classList.toggle("active", b.dataset.dept === currentDept));
                    search(0, false);
                });
                row.appendChild(btn);
            }

            const sep = document.createElement("span");
            sep.style.cssText = "align-self:center;color:var(--border2);flex-shrink:0;padding:0 4px";
            sep.textContent = "|";
            row.appendChild(sep);

            for (const role of ROLES) {
                const btn = document.createElement("button");
                btn.className = "tw-chip" + (role === currentRole ? " active" : "");
                btn.textContent = role;
                btn.dataset.role = role;
                btn.addEventListener("click", () => {
                    currentRole = currentRole === role ? null : role;
                    row.querySelectorAll("[data-role]").forEach(b =>
                        b.classList.toggle("active", b.dataset.role === currentRole));
                    search(0, false);
                });
                row.appendChild(btn);
            }
        }
    }

    async function search(offset = 0, append = false) {
        if (currentTab === "posts") {
            await searchPosts(offset, append);
        } else {
            await searchUsers(offset, append);
        }
    }

    async function searchPosts(offset, append) {
        const query = searchInput.value.trim();
        if (!query && !currentCid) {
            document.getElementById("results").innerHTML = "";
            document.getElementById("searchLabel").textContent = "";
            return;
        }

        const urlParams = new URLSearchParams({ tab: "posts" });
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
            const activeChip = document.querySelector(`[data-cid="${currentCid}"]`);
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

    async function searchUsers(offset, append) {
        const query = searchInput.value.trim();
        if (!query && !currentDept && !currentRole) {
            document.getElementById("results").innerHTML = "";
            document.getElementById("searchLabel").textContent = "";
            return;
        }

        const urlParams = new URLSearchParams({ tab: "users" });
        if (query) urlParams.set("q", query);
        if (currentDept) urlParams.set("department", currentDept);
        if (currentRole) urlParams.set("role", currentRole);
        history.replaceState({}, "", `/search?${urlParams}`);

        const apiParams = new URLSearchParams({ offset, limit: 20 });
        if (query) apiParams.set("q", query);
        if (currentDept) apiParams.set("department", currentDept);
        if (currentRole) apiParams.set("role", currentRole);

        const res = await fetch(`/users/search?${apiParams}`);
        if (res.status === 401) { navigate("/sign"); return; }
        const data = await res.json();

        const container = document.getElementById("results");
        if (!append) container.innerHTML = "";

        const parts = [];
        if (query) parts.push(`「${query}」`);
        if (currentDept) parts.push(currentDept);
        if (currentRole) parts.push(currentRole);
        document.getElementById("searchLabel").textContent =
            parts.length ? `${parts.join(" · ")} のユーザー` : "";

        if (!data.users.length && !append) {
            container.innerHTML = '<p class="tw-empty">該当するユーザーがいませんでした</p>';
        } else {
            data.users.forEach(u => container.appendChild(renderUserRow(u)));
        }

        nextOffset = data.next_offset;
        document.getElementById("moreBtn").style.display = nextOffset !== null ? "block" : "none";
    }

    function renderUserRow(u) {
        const item = document.createElement("div");
        item.className = "tw-follow-item";

        if (u.icon_url) {
            const img = document.createElement("img");
            img.className = "tw-avatar";
            img.src = u.icon_url;
            img.alt = "";
            item.appendChild(img);
        } else {
            const ph = document.createElement("span");
            ph.className = "tw-avatar-ph";
            ph.textContent = (u.name || u.uid).charAt(0).toUpperCase();
            item.appendChild(ph);
        }

        const info = document.createElement("div");
        info.className = "tw-follow-info";
        info.innerHTML = `
            <a class="tw-follow-link" href="/user/${encodeURIComponent(u.uid)}" data-link>${escapeHtml(u.name)}</a>
            <span class="tw-follow-uid-text">@${escapeHtml(u.uid)}</span>
            ${u.department || u.role ? `<div class="tw-profile-badges" style="margin-top:4px">
                ${u.department ? `<span class="tw-profile-dept">${escapeHtml(u.department)}</span>` : ""}
                ${u.role ? `<span class="tw-profile-role">${escapeHtml(u.role)}</span>` : ""}
            </div>` : ""}
        `;
        item.appendChild(info);

        const fc = document.createElement("span");
        fc.style.cssText = "font-size:0.8em;color:var(--text2);flex-shrink:0";
        fc.textContent = `フォロワー ${u.follower_count}`;
        item.appendChild(fc);

        return item;
    }

    searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") search(0, false); });
    document.getElementById("moreBtn").addEventListener("click", () => search(nextOffset, true));

    renderChips().then(() => {
        if (q || initialCid || initialDept || initialRole) search(0, false);
    });
}
