import { navigate } from "../router.js";
import { renderCard } from "../renderUtils.js";
import { showNav } from "../nav.js";

let activeEventSource = null;

export function renderHome() {
    showNav("/");
    if (activeEventSource) { activeEventSource.close(); activeEventSource = null; }

    document.getElementById("app").innerHTML = `
        <div class="tw-header">
            <img class="tw-header-logo-img" src="/logo.png" alt="twifeed">
            <div class="tw-search-wrap">
                <input class="tw-search-input" id="searchInput" type="text" placeholder="検索…">
            </div>
            <button class="tw-header-icon-btn" id="searchBtn" title="検索">🔍</button>
        </div>
        <div class="tw-chips" id="chipRow"></div>
        <div id="trendBanner"></div>
        <div class="tw-page" id="timeline"></div>
        <button class="tw-more" id="moreBtn" style="display:none">もっと見る</button>
        <button class="tw-fab" id="fabBtn" title="投稿">✏️</button>

        <div class="tw-overlay" id="overlay" style="display:none">
            <div class="tw-modal">
                <div class="tw-modal-head">
                    <button class="tw-modal-close" id="closeBtn">✕</button>
                    <button class="tw-post-btn"   id="submitBtn">投稿する</button>
                </div>
                <div class="tw-modal-body">
                    <div class="tw-card-av">
                        <span class="tw-avatar-ph" id="myAvatar">?</span>
                    </div>
                    <div class="tw-compose-right">
                        <textarea class="tw-compose-ta" id="postContent" rows="4" placeholder="いまなにしてる？"></textarea>
                        <div class="tw-compose-previews" id="imagePreviews"></div>
                    </div>
                </div>
                <p class="tw-post-status" id="postStatus"></p>
                <div class="tw-modal-foot">
                    <div class="tw-modal-tools">
                        <label class="tw-img-label" title="画像を追加">
                            🖼
                            <input type="file" id="imageInput" accept="image/jpeg,image/png,image/webp" multiple style="display:none">
                        </label>
                        <select class="tw-cat-select" id="categorySelect">
                            <option value="">カテゴリ</option>
                        </select>
                    </div>
                </div>
                <div class="tw-hot-tags" id="hotTags" style="display:none">
                    <span class="tw-hot-tags-label">🔥 HOT なタグ</span>
                    <div class="tw-hot-tags-chips" id="hotTagsChips"></div>
                </div>
            </div>
        </div>
    `;

    let nextOffset = null;
    let activeCid  = null;
    let activeMode = "following"; // "following" | "all"
    let categories = [];

    // ── Categories ──
    async function loadCategories() {
        const row = document.getElementById("chipRow");
        const sel = document.getElementById("categorySelect");

        // フォロー中チップは常に最初に追加
        const followChip = document.createElement("button");
        followChip.className = "tw-chip active";
        followChip.textContent = "フォロー中";
        followChip.dataset.mode = "following";
        followChip.addEventListener("click", () => selectChip(followChip, "following", null));
        row.appendChild(followChip);

        // 人気チップ（カテゴリ横断トレンド）
        const popularChip = document.createElement("button");
        popularChip.className = "tw-chip";
        popularChip.textContent = "人気";
        popularChip.dataset.mode = "popular";
        popularChip.addEventListener("click", () => selectChip(popularChip, "all", null));
        row.appendChild(popularChip);

        const res = await fetch("/categories");
        if (!res.ok) return;
        const data = await res.json();
        categories = data.categories;

        for (const c of categories) {
            const opt = document.createElement("option");
            opt.value = c.cid;
            opt.textContent = c.name;
            sel.appendChild(opt);

            const btn = document.createElement("button");
            btn.className = "tw-chip";
            btn.textContent = c.name;
            btn.dataset.cid = c.cid;
            btn.addEventListener("click", () => selectChip(btn, "all", c.cid));
            row.appendChild(btn);
        }
    }

    function selectChip(chip, mode, cid) {
        activeMode = mode;
        activeCid  = cid;
        document.getElementById("chipRow").querySelectorAll(".tw-chip")
            .forEach(b => b.classList.remove("active"));
        chip.classList.add("active");
        if (mode === "following") {
            document.getElementById("trendBanner").innerHTML = "";
        } else {
            loadTrendBanner(cid);
        }
        loadTimeline(0, false);
    }

    // ── Long-term trend banner ──
    async function loadTrendBanner(cid = null) {
        const wrap = document.getElementById("trendBanner");
        if (!wrap) return;

        const params = cid ? `?cid=${cid}` : "";
        const res = await fetch(`/trending/long${params}`);
        if (!res.ok) { wrap.innerHTML = ""; return; }
        const { articles } = await res.json();

        wrap.innerHTML = "";
        if (!articles.length) return;

        const outer = document.createElement("div");
        outer.className = "tw-trend-wrap";

        const label = document.createElement("p");
        label.className = "tw-trend-label";
        label.textContent = "長期トレンド";
        outer.appendChild(label);

        const scroll = document.createElement("div");
        scroll.className = "tw-trend-scroll";

        for (const a of articles) {
            const card = document.createElement("div");
            card.className = "tw-trend-card";
            card.addEventListener("click", () => navigate(`/article/${a.aid}`));

            const head = document.createElement("div");
            head.className = "tw-trend-card-head";
            if (a.icon_url) {
                const img = document.createElement("img");
                img.className = "tw-trend-av";
                img.src = a.icon_url;
                img.alt = "";
                head.appendChild(img);
            } else {
                const ph = document.createElement("div");
                ph.className = "tw-trend-av-ph";
                ph.textContent = a.name.charAt(0).toUpperCase();
                head.appendChild(ph);
            }
            const name = document.createElement("span");
            name.className = "tw-trend-name";
            name.textContent = a.name;
            head.appendChild(name);
            card.appendChild(head);

            const content = document.createElement("p");
            content.className = "tw-trend-content";
            content.textContent = a.content;
            card.appendChild(content);

            const foot = document.createElement("div");
            foot.className = "tw-trend-foot";
            const likes = document.createElement("span");
            likes.className = "tw-trend-likes";
            likes.textContent = `♥ ${a.like_count}`;
            foot.appendChild(likes);
            if (a.category_name) {
                const cat = document.createElement("span");
                cat.className = "tw-trend-cat";
                cat.textContent = a.category_name;
                foot.appendChild(cat);
            }
            card.appendChild(foot);

            scroll.appendChild(card);
        }

        outer.appendChild(scroll);
        wrap.appendChild(outer);
    }

    // ── Timeline ──
    async function loadTimeline(offset = 0, append = false) {
        const params = new URLSearchParams({ offset, limit: 20 });
        if (activeMode === "all") {
            params.set("mode", "all");
            if (activeCid) params.set("cid", activeCid);
        }
        const res = await fetch(`/timeline?${params}`);
        if (res.status === 401) { navigate("/sign"); return; }
        const data = await res.json();

        const container = document.getElementById("timeline");
        if (!append) container.innerHTML = "";
        if (data.articles.length === 0 && !append) {
            container.innerHTML = '<p class="tw-empty">投稿がありません</p>';
        } else {
            data.articles.forEach(a => container.appendChild(renderCard(a)));
        }
        nextOffset = data.next_offset;
        document.getElementById("moreBtn").style.display = nextOffset !== null ? "block" : "none";
    }

    // ── Compose ──
    async function loadHotTags() {
        const wrap = document.getElementById("hotTags");
        const chips = document.getElementById("hotTagsChips");
        if (!wrap || !chips) return;
        try {
            const res = await fetch("/trending/tags");
            if (!res.ok) return;
            const { tags } = await res.json();
            if (!tags.length) return;
            chips.innerHTML = "";
            for (const t of tags) {
                const btn = document.createElement("button");
                btn.className = "tw-hot-tag-chip";
                btn.textContent = `#${t.name}`;
                btn.addEventListener("click", () => {
                    const ta = document.getElementById("postContent");
                    const cur = ta.value;
                    const tag = `#${t.name}`;
                    ta.value = cur + (cur && !cur.endsWith(" ") ? " " : "") + tag + " ";
                    ta.focus();
                });
                chips.appendChild(btn);
            }
            wrap.style.display = "block";
        } catch (_) { /* ignore */ }
    }

    function openModal() {
        document.getElementById("overlay").style.display = "flex";
        loadHotTags();
    }
    function closeModal() {
        document.getElementById("overlay").style.display = "none";
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
        const status  = document.getElementById("postStatus");
        const files   = Array.from(document.getElementById("imageInput").files).slice(0, 4);
        const cidVal  = document.getElementById("categorySelect").value;
        const cid     = cidVal ? parseInt(cidVal) : null;
        if (!content) { status.textContent = "内容を入力してください"; return; }

        let image_ids = [];
        try { image_ids = await uploadImages(files); }
        catch (e) { status.textContent = e.message; return; }

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
            loadTimeline(0, false);
        } else {
            const err = await res.json();
            status.textContent = "投稿失敗: " + (err.error || res.status);
        }
    }

    // ── SSE ──
    function prependCard(a) {
        const container = document.getElementById("timeline");
        if (!container) return;
        const empty = container.querySelector(".tw-empty");
        if (empty) container.innerHTML = "";
        container.prepend(renderCard(a));
    }
    activeEventSource = new EventSource("/stream");
    activeEventSource.addEventListener("following_article", (e) => {
        if (activeMode !== "following") return;
        prependCard(JSON.parse(e.data));
    });
    activeEventSource.addEventListener("global_article", (e) => {
        if (activeMode !== "all") return;
        const a = JSON.parse(e.data);
        if (activeCid && a.cid !== activeCid) return;
        prependCard(a);
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

    // ── Events ──
    function goSearch() {
        const q = document.getElementById("searchInput").value.trim();
        navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
    }
    document.getElementById("searchInput").addEventListener("keydown", (e) => { if (e.key === "Enter") goSearch(); });
    document.getElementById("searchBtn").addEventListener("click", goSearch);

    document.getElementById("fabBtn").addEventListener("click", openModal);
    document.getElementById("closeBtn").addEventListener("click", closeModal);
    document.getElementById("submitBtn").addEventListener("click", post);
    document.getElementById("overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeModal(); });
    document.getElementById("moreBtn").addEventListener("click", () => loadTimeline(nextOffset, true));

    // ── Init ──
    async function init() {
        await loadCategories();
        // Load my avatar for compose
        const meRes = await fetch("/users/me");
        if (meRes.ok) {
            const me = await meRes.json();
            const av = document.getElementById("myAvatar");
            if (me.icon_url && av) {
                const img = document.createElement("img");
                img.className = "tw-avatar";
                img.src = me.icon_url;
                av.replaceWith(img);
            } else if (av) {
                av.textContent = (me.name ?? "?").charAt(0).toUpperCase();
            }
        }
        loadTimeline(0, false);
    }
    init();
}
