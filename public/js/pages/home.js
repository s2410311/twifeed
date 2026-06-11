import { navigate } from "../router.js";
import { renderCard } from "../renderUtils.js";

let activeEventSource = null;

export function renderHome() {
    if (activeEventSource) { activeEventSource.close(); activeEventSource = null; }

    document.getElementById("app").innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
            <h1 style="margin:0;flex:1">twifeed</h1>
            <button id="searchToggleBtn" title="検索" style="font-size:1.2em;background:none;border:none;cursor:pointer;padding:4px">🔍</button>
            <a href="/profile" data-link>プロフィール</a>
            <button id="logoutBtn">ログアウト</button>
        </div>
        <div id="searchBar" style="display:none;margin-top:8px">
            <div style="display:flex;gap:6px">
                <input id="searchInput" type="text" placeholder="キーワードを入力…" style="flex:1;padding:6px;font-size:1em">
                <button id="searchSubmitBtn">検索</button>
            </div>
        </div>
        <hr>
        <h2>投稿</h2>
        <textarea id="postContent" rows="3" cols="50" placeholder="いまなにしてる？"></textarea>
        <br>
        <select id="categorySelect">
            <option value="">カテゴリを選択（任意）</option>
        </select>
        <br>
        <input id="imageInput" type="file" accept="image/jpeg,image/png,image/webp" multiple>
        <div id="imagePreviews"></div>
        <br>
        <button id="postBtn">投稿</button>
        <p id="postStatus"></p>
        <hr>
        <div style="display:flex;gap:0;border-bottom:2px solid #ccc;margin-bottom:8px">
            <button id="tabFollowing" style="padding:8px 20px;border:none;border-bottom:2px solid #66a;margin-bottom:-2px;background:none;cursor:pointer;font-weight:bold;color:#66a">フォロー中</button>
            <button id="tabAll" style="padding:8px 20px;border:none;background:none;cursor:pointer;color:#888">全体</button>
        </div>
        <div id="categoryFilters" style="display:none;flex-wrap:wrap;gap:6px;margin-bottom:8px"></div>
        <button id="reloadBtn">更新</button>
        <div id="timeline"></div>
        <button id="moreBtn" style="display:none">もっと見る</button>
    `;

    let nextOffset = null;
    let activeCid = null;
    let activeTab = "following";

    async function loadCategories() {
        const res = await fetch("/categories");
        if (!res.ok) return;
        const { categories } = await res.json();

        const sel = document.getElementById("categorySelect");
        for (const c of categories) {
            const opt = document.createElement("option");
            opt.value = c.cid;
            opt.textContent = c.name;
            sel.appendChild(opt);
        }

        const filters = document.getElementById("categoryFilters");
        for (const c of categories) {
            const btn = document.createElement("button");
            btn.textContent = c.name;
            btn.dataset.cid = c.cid;
            btn.style.cssText = "padding:4px 10px;border-radius:12px;border:1px solid #aaa;background:#fff;cursor:pointer";
            btn.addEventListener("click", () => {
                if (activeCid === c.cid) {
                    activeCid = null;
                    btn.style.background = "#fff";
                    btn.style.color = "";
                } else {
                    activeCid = c.cid;
                    filters.querySelectorAll("button").forEach(b => { b.style.background = "#fff"; b.style.color = ""; });
                    btn.style.background = "#66a";
                    btn.style.color = "#fff";
                }
                loadTimeline(0, false);
            });
            filters.appendChild(btn);
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

    document.getElementById("imageInput").addEventListener("change", (e) => {
        const previews = document.getElementById("imagePreviews");
        previews.innerHTML = "";
        Array.from(e.target.files).slice(0, 4).forEach(file => {
            const img = document.createElement("img");
            img.src = URL.createObjectURL(file);
            img.style.cssText = "max-width:100px;max-height:100px;margin-right:4px";
            previews.appendChild(img);
        });
    });

    async function uploadImages(files) {
        if (!files.length) return [];
        const form = new FormData();
        files.forEach(f => form.append("images", f));
        const res = await fetch("/images", { method: "POST", body: form });
        if (!res.ok) throw new Error("画像のアップロードに失敗しました");
        return (await res.json()).iids;
    }

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
        if (data.articles.length === 0 && !append) container.textContent = "投稿がありません";
        data.articles.forEach(a => container.appendChild(renderArticle(a)));
        nextOffset = data.next_offset;
        document.getElementById("moreBtn").style.display = nextOffset !== null ? "inline" : "none";
    }

    async function post() {
        const content = document.getElementById("postContent").value.trim();
        const status = document.getElementById("postStatus");
        const imageInput = document.getElementById("imageInput");
        const files = Array.from(imageInput.files).slice(0, 4);
        const cidVal = document.getElementById("categorySelect").value;
        const cid = cidVal ? parseInt(cidVal) : null;
        if (!content) { status.textContent = "内容を入力してください"; return; }
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
            imageInput.value = "";
            document.getElementById("imagePreviews").innerHTML = "";
            status.textContent = "投稿しました！";
            status.style.cssText = "color:green;font-weight:bold";
            setTimeout(() => { status.textContent = ""; status.style.cssText = ""; }, 3000);
            await loadTimeline(0, false);
        } else {
            const err = await res.json();
            status.textContent = "投稿失敗: " + (err.error || res.status);
            status.style.color = "red";
        }
    }

    const searchBar = document.getElementById("searchBar");
    document.getElementById("searchToggleBtn").addEventListener("click", () => {
        const visible = searchBar.style.display !== "none";
        searchBar.style.display = visible ? "none" : "block";
        if (!visible) document.getElementById("searchInput").focus();
    });

    function goSearch() {
        const q = document.getElementById("searchInput").value.trim();
        if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
    }
    document.getElementById("searchSubmitBtn").addEventListener("click", goSearch);
    document.getElementById("searchInput").addEventListener("keydown", (e) => {
        if (e.key === "Enter") goSearch();
        if (e.key === "Escape") { searchBar.style.display = "none"; }
    });

    function setTab(tab) {
        activeTab = tab;
        activeCid = null;
        const filters = document.getElementById("categoryFilters");
        const btnFollowing = document.getElementById("tabFollowing");
        const btnAll = document.getElementById("tabAll");
        if (tab === "following") {
            btnFollowing.style.cssText = "padding:8px 20px;border:none;border-bottom:2px solid #66a;margin-bottom:-2px;background:none;cursor:pointer;font-weight:bold;color:#66a";
            btnAll.style.cssText = "padding:8px 20px;border:none;background:none;cursor:pointer;color:#888";
            filters.style.display = "none";
        } else {
            btnAll.style.cssText = "padding:8px 20px;border:none;border-bottom:2px solid #66a;margin-bottom:-2px;background:none;cursor:pointer;font-weight:bold;color:#66a";
            btnFollowing.style.cssText = "padding:8px 20px;border:none;background:none;cursor:pointer;color:#888";
            filters.style.display = "flex";
        }
        filters.querySelectorAll("button").forEach(b => { b.style.background = "#fff"; b.style.color = ""; });
        loadTimeline(0, false);
    }

    document.getElementById("tabFollowing").addEventListener("click", () => setTab("following"));
    document.getElementById("tabAll").addEventListener("click", () => setTab("all"));

    document.getElementById("postBtn").addEventListener("click", post);
    document.getElementById("reloadBtn").addEventListener("click", () => loadTimeline(0, false));
    document.getElementById("moreBtn").addEventListener("click", () => loadTimeline(nextOffset, true));
    document.getElementById("logoutBtn").addEventListener("click", async () => {
        await fetch("/logout", { method: "POST" });
        navigate("/sign");
    });

    function prependArticle(a) {
        const container = document.getElementById("timeline");
        if (!container) return;
        if (container.textContent === "投稿がありません") container.innerHTML = "";
        container.prepend(renderArticle(a));
    }

    activeEventSource = new EventSource("/stream");

    activeEventSource.addEventListener("following_article", (e) => {
        if (activeTab !== "following") return;
        prependArticle(JSON.parse(e.data));
    });

    activeEventSource.addEventListener("global_article", (e) => {
        if (activeTab !== "all") return;
        const article = JSON.parse(e.data);
        if (activeCid && article.cid !== activeCid) return;
        prependArticle(article);
    });

    loadCategories();
    loadTimeline(0, false);
}
