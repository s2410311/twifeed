import { navigate } from "../router.js";
import { renderCard } from "../renderUtils.js";

export function renderHome() {
    document.getElementById("app").innerHTML = `
        <h1>twifeed</h1>
        <a href="/profile" data-link>プロフィール設定</a>
        <button id="logoutBtn">ログアウト</button>
        <hr>
        <h2>投稿</h2>
        <textarea id="postContent" rows="3" cols="50" placeholder="いまなにしてる？"></textarea>
        <br>
        <input id="imageInput" type="file" accept="image/jpeg,image/png,image/webp" multiple>
        <div id="imagePreviews"></div>
        <br>
        <button id="postBtn">投稿</button>
        <p id="postStatus"></p>
        <hr>
        <h2>タイムライン</h2>
        <button id="reloadBtn">更新</button>
        <div id="timeline"></div>
        <button id="moreBtn" style="display:none">もっと見る</button>
    `;

    let nextOffset = null;

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
        const res = await fetch(`/timeline?offset=${offset}&limit=20`);
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
        if (!content) { status.textContent = "内容を入力してください"; return; }
        let image_ids = [];
        try { image_ids = await uploadImages(files); }
        catch (e) { status.textContent = e.message; status.style.color = "red"; return; }
        const res = await fetch("/articles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content, image_ids })
        });
        if (res.status === 401) { navigate("/sign"); return; }
        if (res.status === 201) {
            document.getElementById("postContent").value = "";
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

    document.getElementById("postBtn").addEventListener("click", post);
    document.getElementById("reloadBtn").addEventListener("click", () => loadTimeline(0, false));
    document.getElementById("moreBtn").addEventListener("click", () => loadTimeline(nextOffset, true));
    document.getElementById("logoutBtn").addEventListener("click", async () => {
        await fetch("/logout", { method: "POST" });
        navigate("/sign");
    });

    loadTimeline(0, false);
}
