import { navigate } from "../router.js";
import { escapeHtml, formatDate, linkifyTags, toggleLike } from "../renderUtils.js";

let activeEventSource = null;

function buildCard(a) {
    const card = document.createElement("div");
    card.className = "post-card";

    const quote = (a.parent_aid && a.parent_name) ? `
        <div class="quote-card">
            <strong>${escapeHtml(a.parent_name)}</strong>
            <span class="post-user-id">@${escapeHtml(a.parent_uid ?? "")}</span>
            <p>${escapeHtml((a.parent_content ?? "").slice(0, 100))}${(a.parent_content ?? "").length > 100 ? "…" : ""}</p>
        </div>` : "";

    const avatarEl = a.icon_url
        ? `<a href="/user/${encodeURIComponent(a.uid)}" data-link><img class="avatar" src="${escapeHtml(a.icon_url)}" alt=""></a>`
        : `<a class="avatar-ph" href="/user/${encodeURIComponent(a.uid)}" data-link>${escapeHtml(a.name.charAt(0).toUpperCase())}</a>`;

    const liked = !!a.liked;
    card.innerHTML = `
        ${quote}
        <div class="post-card-top">
            ${avatarEl}
            <div class="post-user-info">
                <a class="post-user-name" href="/user/${encodeURIComponent(a.uid)}" data-link>${escapeHtml(a.name)}</a>
                <span class="post-user-id">@${escapeHtml(a.uid)}</span>
                <span class="post-date">${formatDate(a.created_at)}</span>
            </div>
            <button class="like-btn${liked ? " liked" : ""}" data-aid="${a.aid}" data-liked="${liked ? "1" : "0"}">${liked ? "♥" : "♡"} ${a.like_count}</button>
        </div>
        <p class="post-content">${linkifyTags(a.content)}</p>
        <div class="post-footer">
            <span>💬 ${a.reply_count}</span>
            ${a.category_name ? `<span class="category-badge">${escapeHtml(a.category_name)}</span>` : ""}
            <a href="/article/${a.aid}" data-link>詳細</a>
        </div>
    `;

    card.querySelector(".like-btn").addEventListener("click", (e) => toggleLike(e.currentTarget));

    if (a.images?.length > 0) {
        const grid = document.createElement("div");
        const n = Math.min(a.images.length, 4);
        grid.className = `post-images cols-${n}`;
        a.images.slice(0, 4).forEach(img => {
            const el = document.createElement("img");
            el.src = img.thumbnail_url;
            el.alt = "";
            el.addEventListener("click", () => window.open(img.url, "_blank"));
            grid.appendChild(el);
        });
        card.querySelector(".post-footer").insertAdjacentElement("beforebegin", grid);
    }

    return card;
}

export function renderHome() {
    if (activeEventSource) { activeEventSource.close(); activeEventSource = null; }

    document.getElementById("app").innerHTML = `
        <div class="home-header">TwiFeed</div>
        <div class="search-wrap">
            <input id="searchInput" type="text" placeholder="キーワードを入力…">
        </div>
        <div class="chip-row" id="chipRow"></div>
        <div class="feed" id="timeline"></div>
        <button class="more-btn" id="moreBtn" style="display:none">もっと見る</button>
        <button class="fab" id="fabBtn" title="投稿">＋</button>

        <div class="post-overlay" id="postOverlay" style="display:none">
            <div class="post-sheet">
                <div class="post-sheet-header">
                    <h3>新しい投稿</h3>
                    <div style="display:flex;gap:8px">
                        <button id="cancelPostBtn">キャンセル</button>
                        <button id="submitPostBtn">投稿</button>
                    </div>
                </div>
                <textarea id="postContent" rows="4" placeholder="いまなにしてる？"></textarea>
                <select id="categorySelect">
                    <option value="">カテゴリを選択（任意）</option>
                </select>
                <input id="imageInput" type="file" accept="image/jpeg,image/png,image/webp" multiple>
                <div id="imagePreviews"></div>
                <p id="postStatus"></p>
            </div>
        </div>
    `;

    let nextOffset = null;
    let activeCid = null;
    let activeTab = "following";

    // ── Chips ──
    function buildChips(categories) {
        const row = document.getElementById("chipRow");
        row.innerHTML = "";

        const tabs = [
            { label: "フォロー中", key: "following" },
            { label: "全体", key: "all" },
        ];
        tabs.forEach(({ label, key }) => {
            const btn = document.createElement("button");
            btn.className = "chip" + (activeTab === key ? " active" : "");
            btn.textContent = label;
            btn.addEventListener("click", () => setTab(key));
            row.appendChild(btn);
        });

        const sep = document.createElement("span");
        sep.style.cssText = "width:1px;background:#ddd;flex-shrink:0;align-self:stretch;margin:4px 0";
        row.appendChild(sep);

        categories.forEach(c => {
            const btn = document.createElement("button");
            btn.className = "chip" + (activeCid === c.cid ? " active" : "");
            btn.textContent = c.name;
            btn.dataset.cid = c.cid;
            btn.style.display = activeTab === "all" ? "" : "none";
            btn.addEventListener("click", () => {
                activeCid = activeCid === c.cid ? null : c.cid;
                buildChips(categories);
                loadTimeline(0, false);
            });
            row.appendChild(btn);
        });
    }

    function setTab(tab) {
        activeTab = tab;
        activeCid = null;
        const chips = document.querySelectorAll("#chipRow .chip");
        chips.forEach(c => {
            if (c.dataset.cid) {
                c.style.display = tab === "all" ? "" : "none";
                c.classList.remove("active");
            } else {
                const isActive = (tab === "following" && c.textContent === "フォロー中") ||
                                 (tab === "all" && c.textContent === "全体");
                c.classList.toggle("active", isActive);
            }
        });
        loadTimeline(0, false);
    }

    // ── Timeline ──
    async function loadTimeline(offset = 0, append = false) {
        const params = new URLSearchParams({ offset, limit: 20 });
        if (activeTab === "all") {
            params.set("mode", "all");
            if (activeCid) params.set("cid", activeCid);
        }
        const res = await fetch(`/timeline?${params}`);
        if (res.status === 401) { navigate("/sign"); return; }
        const data = await res.json();

        const container = document.getElementById("timeline");
        if (!append) container.innerHTML = "";
        if (data.articles.length === 0 && !append) {
            container.innerHTML = '<p class="feed-empty">投稿がありません</p>';
        } else {
            data.articles.forEach(a => container.appendChild(buildCard(a)));
        }
        nextOffset = data.next_offset;
        document.getElementById("moreBtn").style.display = nextOffset !== null ? "block" : "none";
    }

    // ── Post ──
    function openModal() { document.getElementById("postOverlay").style.display = "flex"; }
    function closeModal() {
        document.getElementById("postOverlay").style.display = "none";
        document.getElementById("postStatus").textContent = "";
    }

    async function uploadImages(files) {
        if (!files.length) return [];
        const form = new FormData();
        files.forEach(f => form.append("images", f));
        const res = await fetch("/images", { method: "POST", body: form });
        if (!res.ok) throw new Error("画像のアップロードに失敗しました");
        return (await res.json()).iids;
    }

    async function post() {
        const content = document.getElementById("postContent").value.trim();
        const status = document.getElementById("postStatus");
        const files = Array.from(document.getElementById("imageInput").files).slice(0, 4);
        const cidVal = document.getElementById("categorySelect").value;
        const cid = cidVal ? parseInt(cidVal) : null;

        if (!content) { status.textContent = "内容を入力してください"; status.style.color = "red"; return; }

        let image_ids = [];
        try { image_ids = await uploadImages(files); }
        catch (e) { status.textContent = e.message; status.style.color = "red"; return; }

        const res = await fetch("/articles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content, cid, image_ids })
        });
        if (res.status === 401) { navigate("/sign"); return; }
        if (res.status === 201) {
            document.getElementById("postContent").value = "";
            document.getElementById("categorySelect").value = "";
            document.getElementById("imageInput").value = "";
            document.getElementById("imagePreviews").innerHTML = "";
            closeModal();
            await loadTimeline(0, false);
        } else {
            const err = await res.json();
            status.textContent = "投稿失敗: " + (err.error || res.status);
            status.style.color = "red";
        }
    }

    // ── Search ──
    document.getElementById("searchInput").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const q = e.currentTarget.value.trim();
            if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
        }
    });

    // ── Image preview ──
    document.getElementById("imageInput").addEventListener("change", (e) => {
        const previews = document.getElementById("imagePreviews");
        previews.innerHTML = "";
        Array.from(e.target.files).slice(0, 4).forEach(file => {
            const img = document.createElement("img");
            img.src = URL.createObjectURL(file);
            previews.appendChild(img);
        });
    });

    // ── SSE ──
    function prependCard(a) {
        const container = document.getElementById("timeline");
        if (!container) return;
        const empty = container.querySelector(".feed-empty");
        if (empty) container.innerHTML = "";
        container.prepend(buildCard(a));
    }

    activeEventSource = new EventSource("/stream");
    activeEventSource.addEventListener("following_article", (e) => {
        if (activeTab !== "following") return;
        prependCard(JSON.parse(e.data));
    });
    activeEventSource.addEventListener("global_article", (e) => {
        if (activeTab !== "all") return;
        const article = JSON.parse(e.data);
        if (activeCid && article.cid !== activeCid) return;
        prependCard(article);
    });

    // ── Event listeners ──
    document.getElementById("fabBtn").addEventListener("click", openModal);
    document.getElementById("cancelPostBtn").addEventListener("click", closeModal);
    document.getElementById("submitPostBtn").addEventListener("click", post);
    document.getElementById("moreBtn").addEventListener("click", () => loadTimeline(nextOffset, true));
    document.getElementById("postOverlay").addEventListener("click", (e) => {
        if (e.target === e.currentTarget) closeModal();
    });

    // ── Init ──
    async function init() {
        const res = await fetch("/categories");
        let categories = [];
        if (res.ok) {
            const data = await res.json();
            categories = data.categories;
            const sel = document.getElementById("categorySelect");
            for (const c of categories) {
                const opt = document.createElement("option");
                opt.value = c.cid;
                opt.textContent = c.name;
                sel.appendChild(opt);
            }
        }
        buildChips(categories);
        loadTimeline(0, false);
    }

    init();
}
