let nextOffset = null;

function formatDate(ts) {
    return new Date(ts).toLocaleString("ja-JP");
}

function renderArticle(a) {
    const div = document.createElement("div");
    div.style.borderBottom = "1px solid #ccc";
    div.style.padding = "8px 0";

    const liked = !!a.liked;
    const likeBtn = document.createElement("button");
    likeBtn.textContent = `${liked ? "♥" : "♡"} ${a.like_count}`;
    likeBtn.dataset.aid = a.aid;
    likeBtn.dataset.liked = liked ? "1" : "0";
    likeBtn.addEventListener("click", () => toggleLike(likeBtn));

    const detailLink = document.createElement("a");
    detailLink.href = `/article.html?aid=${a.aid}`;
    detailLink.textContent = "詳細";
    detailLink.style.fontSize = "0.85em";
    detailLink.style.marginLeft = "8px";

    const replyCount = document.createElement("span");
    replyCount.textContent = `💬 ${a.reply_count}`;
    replyCount.style.fontSize = "0.85em";
    replyCount.style.color = "#888";
    replyCount.style.marginLeft = "8px";

    const quote = a.parent_aid ? `
        <div style="border:1px solid #ccc;border-radius:4px;padding:6px;margin-bottom:6px;color:#555;font-size:0.9em">
            <strong>${escapeHtml(a.parent_name ?? "")}</strong>
            <span style="color:#aaa"> @${escapeHtml(a.parent_uid ?? "")}</span>
            <p style="margin:2px 0;white-space:pre-wrap">${escapeHtml((a.parent_content ?? "").slice(0, 100))}${(a.parent_content ?? "").length > 100 ? "…" : ""}</p>
        </div>
    ` : "";

    div.innerHTML = `
        ${quote}
        <strong>${escapeHtml(a.name)}</strong>
        <span style="color:#888;font-size:0.85em"> @${escapeHtml(a.uid)} · ${formatDate(a.created_at)}</span>
        <p style="margin:4px 0">${escapeHtml(a.content)}</p>
    `;

    if (a.images && a.images.length > 0) {
        const imgWrap = document.createElement("div");
        for (const img of a.images) {
            const el = document.createElement("img");
            el.src = img.thumbnail_url;
            el.alt = "";
            el.style.maxWidth = "200px";
            el.style.maxHeight = "200px";
            el.style.marginRight = "4px";
            el.style.cursor = "pointer";
            el.addEventListener("click", () => window.open(img.url, "_blank"));
            imgWrap.appendChild(el);
        }
        div.appendChild(imgWrap);
    }

    div.appendChild(likeBtn);
    div.appendChild(replyCount);
    div.appendChild(detailLink);
    return div;
}

async function toggleLike(btn) {
    const aid = btn.dataset.aid;
    const liked = btn.dataset.liked === "1";

    const res = await fetch(`/articles/${aid}/likes`, {
        method: liked ? "DELETE" : "POST"
    });

    if (res.status === 401) {
        window.location.href = "/sign.html";
        return;
    }

    if (res.ok) {
        const newLiked = !liked;
        const count = parseInt(btn.textContent.replace(/\D/g, "")) + (newLiked ? 1 : -1);
        btn.dataset.liked = newLiked ? "1" : "0";
        btn.textContent = `${newLiked ? "♥" : "♡"} ${count}`;
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// 画像選択時にプレビューを表示
document.getElementById("imageInput").addEventListener("change", (e) => {
    const previews = document.getElementById("imagePreviews");
    previews.innerHTML = "";
    const files = Array.from(e.target.files).slice(0, 4);
    for (const file of files) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.style.maxWidth = "100px";
        img.style.maxHeight = "100px";
        img.style.marginRight = "4px";
        previews.appendChild(img);
    }
});

async function uploadImages(files) {
    if (files.length === 0) return [];
    const form = new FormData();
    for (const file of files) form.append("images", file);
    const res = await fetch("/images", { method: "POST", body: form });
    if (!res.ok) throw new Error("画像のアップロードに失敗しました");
    const data = await res.json();
    return data.iids;
}

async function loadTimeline(offset = 0, append = false) {
    const res = await fetch(`/timeline?offset=${offset}&limit=20`);

    if (res.status === 401) {
        window.location.href = "/sign.html";
        return;
    }

    const data = await res.json();
    const container = document.getElementById("timeline");

    if (!append) container.innerHTML = "";

    if (data.articles.length === 0 && !append) {
        container.textContent = "投稿がありません";
    }

    for (const a of data.articles) {
        container.appendChild(renderArticle(a));
    }

    nextOffset = data.next_offset;
    document.getElementById("moreBtn").style.display =
        nextOffset !== null ? "inline" : "none";
}

async function post() {
    const content = document.getElementById("postContent").value.trim();
    const status = document.getElementById("postStatus");
    const imageInput = document.getElementById("imageInput");
    const files = Array.from(imageInput.files).slice(0, 4);

    if (!content) {
        status.textContent = "内容を入力してください";
        return;
    }

    let image_ids = [];
    try {
        image_ids = await uploadImages(files);
    } catch (e) {
        status.textContent = e.message;
        status.style.color = "red";
        return;
    }

    const res = await fetch("/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, image_ids })
    });

    if (res.status === 401) {
        window.location.href = "/sign.html";
        return;
    }

    if (res.status === 201) {
        document.getElementById("postContent").value = "";
        imageInput.value = "";
        document.getElementById("imagePreviews").innerHTML = "";
        status.textContent = "投稿しました！";
        status.style.color = "green";
        status.style.fontWeight = "bold";
        setTimeout(() => {
            status.textContent = "";
            status.style.color = "";
            status.style.fontWeight = "";
        }, 3000);
        await loadTimeline(0, false);
    } else {
        const err = await res.json();
        status.textContent = "投稿失敗: " + (err.error || res.status);
        status.style.color = "red";
    }
}

async function logout() {
    await fetch("/logout", { method: "POST" });
    window.location.href = "/sign.html";
}

document.getElementById("postBtn").addEventListener("click", post);
document.getElementById("reloadBtn").addEventListener("click", () => loadTimeline(0, false));
document.getElementById("moreBtn").addEventListener("click", () => loadTimeline(nextOffset, true));
document.getElementById("logoutBtn").addEventListener("click", logout);

loadTimeline(0, false);
