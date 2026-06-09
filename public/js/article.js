const aid = parseInt(new URLSearchParams(location.search).get("aid"));

if (isNaN(aid)) {
    document.getElementById("thread").textContent = "投稿が見つかりません";
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatDate(ts) {
    return new Date(ts).toLocaleString("ja-JP");
}

// フラットな記事リストからツリーを構築
function buildTree(articles, rootAid) {
    const map = {};
    for (const a of articles) map[a.aid] = { ...a, children: [] };
    const root = map[rootAid];
    for (const a of articles) {
        if (a.parent_aid && map[a.parent_aid]) {
            map[a.parent_aid].children.push(map[a.aid]);
        }
    }
    return root;
}

function renderNode(node, depth = 0) {
    const div = document.createElement("div");
    div.style.marginLeft = `${depth * 24}px`;
    div.style.borderLeft = depth > 0 ? "2px solid #ddd" : "none";
    div.style.paddingLeft = depth > 0 ? "8px" : "0";
    div.style.marginBottom = "8px";

    const liked = !!node.liked;
    const likeBtn = document.createElement("button");
    likeBtn.textContent = `${liked ? "♥" : "♡"} ${node.like_count}`;
    likeBtn.dataset.aid = node.aid;
    likeBtn.dataset.liked = liked ? "1" : "0";
    likeBtn.addEventListener("click", () => toggleLike(likeBtn));

    const replyBtn = document.createElement("button");
    replyBtn.textContent = "返信";
    replyBtn.style.marginLeft = "8px";
    replyBtn.addEventListener("click", () => toggleReplyForm(node.aid, replyForm));

    const replyForm = buildReplyForm(node.aid);

    div.innerHTML = `
        <strong>${escapeHtml(node.name)}</strong>
        <span style="color:#888;font-size:0.85em"> @${escapeHtml(node.uid)} · ${formatDate(node.created_at)}</span>
        <p style="margin:4px 0">${escapeHtml(node.content)}</p>
    `;

    if (node.images && node.images.length > 0) {
        const imgWrap = document.createElement("div");
        for (const img of node.images) {
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
    div.appendChild(replyBtn);
    div.appendChild(replyForm);

    for (const child of node.children) {
        div.appendChild(renderNode(child, depth + 1));
    }

    return div;
}

function buildReplyForm(parentAid) {
    const form = document.createElement("div");
    form.style.display = "none";
    form.style.marginTop = "6px";

    const textarea = document.createElement("textarea");
    textarea.rows = 2;
    textarea.cols = 40;
    textarea.placeholder = "返信を入力…";

    const submitBtn = document.createElement("button");
    submitBtn.textContent = "返信する";
    submitBtn.style.marginLeft = "4px";
    submitBtn.addEventListener("click", async () => {
        const content = textarea.value.trim();
        if (!content) return;
        const res = await fetch(`/articles/${parentAid}/replies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content })
        });
        if (res.status === 401) { window.location.href = "/sign.html"; return; }
        if (res.status === 201) {
            textarea.value = "";
            form.style.display = "none";
            await loadThread();
        }
    });

    form.appendChild(textarea);
    form.appendChild(submitBtn);
    return form;
}

function toggleReplyForm(parentAid, form) {
    form.style.display = form.style.display === "none" ? "block" : "none";
}

async function toggleLike(btn) {
    const aid = btn.dataset.aid;
    const liked = btn.dataset.liked === "1";
    const res = await fetch(`/articles/${aid}/likes`, { method: liked ? "DELETE" : "POST" });
    if (res.status === 401) { window.location.href = "/sign.html"; return; }
    if (res.ok) {
        const newLiked = !liked;
        const count = parseInt(btn.textContent.replace(/\D/g, "")) + (newLiked ? 1 : -1);
        btn.dataset.liked = newLiked ? "1" : "0";
        btn.textContent = `${newLiked ? "♥" : "♡"} ${count}`;
    }
}

async function loadThread() {
    const res = await fetch(`/articles/${aid}/thread`);
    if (res.status === 401) { window.location.href = "/sign.html"; return; }
    if (res.status === 404) { document.getElementById("thread").textContent = "投稿が見つかりません"; return; }

    const { articles, root_aid } = await res.json();
    const root = buildTree(articles, root_aid);

    const container = document.getElementById("thread");
    container.innerHTML = "";
    if (root) container.appendChild(renderNode(root, 0));
}

loadThread();
