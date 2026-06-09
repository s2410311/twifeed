import { navigate } from "../router.js";
import { escapeHtml, formatDate, linkifyTags, toggleLike } from "../renderUtils.js";

function buildTree(articles, rootAid) {
    const map = {};
    for (const a of articles) map[a.aid] = { ...a, children: [] };
    for (const a of articles) {
        if (a.parent_aid && map[a.parent_aid]) {
            map[a.parent_aid].children.push(map[a.aid]);
        }
    }
    return map[rootAid];
}

function buildReplyForm(parentAid, reload) {
    const form = document.createElement("div");
    form.style.display = "none";
    form.style.marginTop = "6px";
    const textarea = document.createElement("textarea");
    textarea.rows = 2; textarea.cols = 40; textarea.placeholder = "返信を入力…";
    const btn = document.createElement("button");
    btn.textContent = "返信する";
    btn.style.marginLeft = "4px";
    btn.addEventListener("click", async () => {
        const content = textarea.value.trim();
        if (!content) return;
        const res = await fetch(`/articles/${parentAid}/replies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content })
        });
        if (res.status === 401) { navigate("/sign"); return; }
        if (res.status === 201) { textarea.value = ""; form.style.display = "none"; reload(); }
    });
    form.appendChild(textarea);
    form.appendChild(btn);
    return form;
}

function renderNode(node, depth, reload) {
    const div = document.createElement("div");
    div.style.marginLeft   = `${depth * 24}px`;
    div.style.borderLeft   = depth > 0 ? "2px solid #ddd" : "none";
    div.style.paddingLeft  = depth > 0 ? "8px" : "0";
    div.style.marginBottom = "8px";

    const liked = !!node.liked;
    const likeBtn = document.createElement("button");
    likeBtn.textContent   = `${liked ? "♥" : "♡"} ${node.like_count}`;
    likeBtn.dataset.aid   = node.aid;
    likeBtn.dataset.liked = liked ? "1" : "0";
    likeBtn.addEventListener("click", () => toggleLike(likeBtn));

    const replyBtn = document.createElement("button");
    replyBtn.textContent      = "返信";
    replyBtn.style.marginLeft = "8px";
    const replyForm = buildReplyForm(node.aid, reload);
    replyBtn.addEventListener("click", () => {
        replyForm.style.display = replyForm.style.display === "none" ? "block" : "none";
    });

    div.innerHTML = `
        <strong><a href="/user/${encodeURIComponent(node.uid)}" data-link style="color:inherit;text-decoration:none">${escapeHtml(node.name)}</a></strong>
        <span style="color:#888;font-size:0.85em"> @${escapeHtml(node.uid)} · ${formatDate(node.created_at)}</span>
        <p style="margin:4px 0;white-space:pre-wrap">${linkifyTags(node.content)}</p>
    `;

    if (node.images?.length > 0) {
        const wrap = document.createElement("div");
        for (const img of node.images) {
            const el = document.createElement("img");
            el.src = img.thumbnail_url;
            el.style.cssText = "max-width:200px;max-height:200px;margin-right:4px;cursor:pointer";
            el.addEventListener("click", () => window.open(img.url, "_blank"));
            wrap.appendChild(el);
        }
        div.appendChild(wrap);
    }

    div.appendChild(likeBtn);
    div.appendChild(replyBtn);
    div.appendChild(replyForm);
    for (const child of node.children) div.appendChild(renderNode(child, depth + 1, reload));
    return div;
}

export function renderArticle(aid) {
    document.getElementById("app").innerHTML = `
        <a href="/" data-link>← ホームに戻る</a>
        <hr>
        <div id="thread"></div>
    `;

    async function load() {
        const res = await fetch(`/articles/${aid}/thread`);
        if (res.status === 401) { navigate("/sign"); return; }
        if (res.status === 404) { document.getElementById("thread").textContent = "投稿が見つかりません"; return; }
        const { articles, root_aid } = await res.json();
        const container = document.getElementById("thread");
        container.innerHTML = "";
        const root = buildTree(articles, root_aid);
        if (root) container.appendChild(renderNode(root, 0, load));
    }

    load();
}
