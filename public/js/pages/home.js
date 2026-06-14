import { navigate } from "../router.js";
import { renderCard } from "../renderUtils.js";
import { showNav } from "../nav.js";

let activeEventSource = null;

export function renderHome() {
    showNav("/");
    if (activeEventSource) { activeEventSource.close(); activeEventSource = null; }

    document.getElementById("app").innerHTML = `
        <div class="tw-header">
            <div class="tw-search-wrap">
                <input class="tw-search-input" id="searchInput" type="text" placeholder="検索…">
            </div>
            <button class="tw-header-icon-btn" id="searchBtn" title="検索">🔍</button>
        </div>
        <div class="tw-chips" id="chipRow"></div>
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
        loadTimeline(0, false);
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
    function openModal() { document.getElementById("overlay").style.display = "flex"; }
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
