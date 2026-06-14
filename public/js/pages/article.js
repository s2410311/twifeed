import { navigate } from "../router.js";
import { escapeHtml, formatDate, linkifyTags, toggleLike } from "../renderUtils.js";
import { showNav } from "../nav.js";

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

function renderNode(node, depth, reload) {
    const wrap = document.createElement("div");

    const item = document.createElement("div");
    item.className = "tw-thread-item";

    // Left: avatar + line
    const left = document.createElement("div");
    left.className = "tw-thread-left";

    const avLink = document.createElement("a");
    avLink.href = `/user/${encodeURIComponent(node.uid)}`;
    avLink.setAttribute("data-link", "");
    if (node.icon_url) {
        const img = document.createElement("img");
        img.className = "tw-avatar";
        img.src = node.icon_url;
        img.alt = "";
        avLink.appendChild(img);
    } else {
        const ph = document.createElement("span");
        ph.className = "tw-avatar-ph";
        ph.textContent = node.name.charAt(0).toUpperCase();
        avLink.appendChild(ph);
    }
    left.appendChild(avLink);
    if (node.children.length > 0) {
        const line = document.createElement("div");
        line.className = "tw-thread-line";
        left.appendChild(line);
    }
    item.appendChild(left);

    // Right: body
    const body = document.createElement("div");
    body.className = "tw-thread-body";

    body.insertAdjacentHTML("beforeend", `
        <div class="tw-card-meta">
            <a class="tw-name" href="/user/${encodeURIComponent(node.uid)}" data-link>${escapeHtml(node.name)}</a>
            <span class="tw-uid">@${escapeHtml(node.uid)}</span>
            <span class="tw-dot">·</span>
            <span class="tw-date">${formatDate(node.created_at)}</span>
        </div>
    `);

    const content = document.createElement("p");
    content.className = "tw-content";
    content.innerHTML = linkifyTags(node.content);
    body.appendChild(content);

    if (node.images?.length > 0) {
        const n = Math.min(node.images.length, 4);
        const grid = document.createElement("div");
        grid.className = `tw-imgs n${n}`;
        node.images.slice(0, 4).forEach(img => {
            const el = document.createElement("img");
            el.src = img.thumbnail_url;
            el.alt = "";
            el.addEventListener("click", () => window.open(img.url, "_blank"));
            grid.appendChild(el);
        });
        body.appendChild(grid);
    }

    // Actions
    const liked = !!node.liked;
    const actions = document.createElement("div");
    actions.className = "tw-actions";

    const likeBtn = document.createElement("button");
    likeBtn.className = `tw-act like${liked ? " liked" : ""}`;
    likeBtn.dataset.aid   = node.aid;
    likeBtn.dataset.liked = liked ? "1" : "0";
    likeBtn.innerHTML = `<span class="li">${liked ? "♥" : "♡"}</span><span class="lc">${node.like_count}</span>`;
    likeBtn.addEventListener("click", () => toggleLike(likeBtn));

    const replyToggle = document.createElement("button");
    replyToggle.className = "tw-act";
    replyToggle.textContent = "💬 返信";
    actions.appendChild(likeBtn);
    actions.appendChild(replyToggle);
    body.appendChild(actions);

    // Inline reply form (hidden)
    const replyBar = document.createElement("div");
    replyBar.className = "tw-reply-bar";
    replyBar.style.display = "none";
    replyBar.innerHTML = `
        <div class="tw-compose-right tw-reply-box">
            <textarea class="tw-reply-textarea" rows="2" placeholder="返信する…"></textarea>
            <div class="tw-reply-footer">
                <button class="tw-reply-btn">返信する</button>
            </div>
        </div>
    `;
    replyToggle.addEventListener("click", () => {
        replyBar.style.display = replyBar.style.display === "none" ? "flex" : "none";
        if (replyBar.style.display === "flex") replyBar.querySelector("textarea").focus();
    });
    replyBar.querySelector(".tw-reply-btn").addEventListener("click", async () => {
        const ta = replyBar.querySelector("textarea");
        const content = ta.value.trim();
        if (!content) return;
        const res = await fetch(`/articles/${node.aid}/replies`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content })
        });
        if (res.status === 401) { navigate("/sign"); return; }
        if (res.status === 201) { ta.value = ""; replyBar.style.display = "none"; reload(); }
    });

    item.appendChild(body);
    wrap.appendChild(item);
    wrap.appendChild(replyBar);

    for (const child of node.children) {
        wrap.appendChild(renderNode(child, depth + 1, reload));
    }
    return wrap;
}

export function renderArticle(aid) {
    showNav("/");

    document.getElementById("app").innerHTML = `
        <div class="tw-header">
            <a class="tw-header-icon-btn" href="/" data-link title="戻る">←</a>
            <span class="tw-header-title">スレッド</span>
        </div>
        <div class="tw-page" id="thread"></div>
    `;

    async function load() {
        const [threadRes] = await Promise.all([
            fetch(`/articles/${aid}/thread`),
            fetch(`/articles/${aid}`),  // view_count increment (fire-and-forget)
        ]);
        if (threadRes.status === 401) { navigate("/sign"); return; }
        const container = document.getElementById("thread");
        if (threadRes.status === 404) { container.innerHTML = '<p class="tw-empty">投稿が見つかりません</p>'; return; }
        const { articles, root_aid } = await threadRes.json();
        container.innerHTML = "";
        const root = buildTree(articles, root_aid);
        if (root) container.appendChild(renderNode(root, 0, load));
    }

    load();
}
