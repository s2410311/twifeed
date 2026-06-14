import { navigate } from "./router.js";

export function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function formatDate(ts) {
    const diff = Date.now() - ts;
    const s = diff / 1000;
    const m = s / 60;
    const h = m / 60;
    const d = h / 24;
    if (s < 60)  return `${Math.floor(s)}秒`;
    if (m < 60)  return `${Math.floor(m)}分`;
    if (h < 24)  return `${Math.floor(h)}時間`;
    if (d < 7)   return `${Math.floor(d)}日`;
    return new Date(ts).toLocaleDateString("ja-JP");
}

export function linkifyTags(content) {
    return escapeHtml(content).replace(
        /#([a-zA-Z0-9぀-ヿ一-鿿＀-￯_.]+)/gu,
        (_, tag) => `<a href="/tag/${encodeURIComponent(tag)}" data-link>#${escapeHtml(tag)}</a>`
    );
}

export async function toggleLike(btn) {
    const aid = btn.dataset.aid;
    const liked = btn.dataset.liked === "1";
    const res = await fetch(`/articles/${aid}/likes`, { method: liked ? "DELETE" : "POST" });
    if (res.status === 401) { navigate("/sign"); return; }
    if (res.ok) {
        const newLiked = !liked;
        const countEl = btn.querySelector(".lc");
        const count = parseInt(countEl?.textContent ?? "0") + (newLiked ? 1 : -1);
        btn.dataset.liked = newLiked ? "1" : "0";
        btn.classList.toggle("liked", newLiked);
        const iconEl = btn.querySelector(".li");
        if (iconEl) iconEl.textContent = newLiked ? "♥" : "♡";
        if (countEl) countEl.textContent = count;
    }
}

export function renderCard(a, { showQuote = true } = {}) {
    const card = document.createElement("div");
    card.className = "tw-card";
    card.addEventListener("click", (e) => {
        if (e.target.closest("a,button")) return;
        navigate(`/article/${a.aid}`);
    });

    // Avatar
    const avLink = document.createElement("a");
    avLink.className = "tw-card-av";
    avLink.href = `/user/${encodeURIComponent(a.uid)}`;
    avLink.setAttribute("data-link", "");
    if (a.icon_url) {
        const img = document.createElement("img");
        img.className = "tw-avatar";
        img.src = a.icon_url;
        img.alt = "";
        avLink.appendChild(img);
    } else {
        const ph = document.createElement("span");
        ph.className = "tw-avatar-ph";
        ph.textContent = a.name.charAt(0).toUpperCase();
        avLink.appendChild(ph);
    }
    card.appendChild(avLink);

    // Body
    const body = document.createElement("div");
    body.className = "tw-card-body";

    // Meta
    body.insertAdjacentHTML("beforeend", `
        <div class="tw-card-meta">
            <a class="tw-name" href="/user/${encodeURIComponent(a.uid)}" data-link>${escapeHtml(a.name)}</a>
            <span class="tw-uid">@${escapeHtml(a.uid)}</span>
            <span class="tw-dot">·</span>
            <span class="tw-date">${formatDate(a.created_at)}</span>
        </div>
    `);

    // Quote
    if (showQuote && a.parent_aid && a.parent_name) {
        body.insertAdjacentHTML("beforeend", `
            <div class="tw-quote">
                <div class="tw-quote-meta">
                    <a class="tw-quote-name" href="/user/${encodeURIComponent(a.parent_uid ?? "")}" data-link>${escapeHtml(a.parent_name)}</a>
                    <span class="tw-uid">@${escapeHtml(a.parent_uid ?? "")}</span>
                </div>
                <p class="tw-quote-content">${escapeHtml((a.parent_content ?? "").slice(0, 100))}${(a.parent_content ?? "").length > 100 ? "…" : ""}</p>
            </div>
        `);
    }

    // Badge (links to category search)
    if (a.category_name && a.cid) {
        body.insertAdjacentHTML("beforeend", `<a class="tw-badge" href="/search?cid=${encodeURIComponent(a.cid)}" data-link>${escapeHtml(a.category_name)}</a>`);
    } else if (a.category_name) {
        body.insertAdjacentHTML("beforeend", `<span class="tw-badge">${escapeHtml(a.category_name)}</span>`);
    }

    // Content
    const content = document.createElement("p");
    content.className = "tw-content";
    content.innerHTML = linkifyTags(a.content);
    body.appendChild(content);

    // Images
    if (a.images?.length > 0) {
        const n = Math.min(a.images.length, 4);
        const grid = document.createElement("div");
        grid.className = `tw-imgs n${n}`;
        a.images.slice(0, 4).forEach(img => {
            const el = document.createElement("img");
            el.src = img.thumbnail_url;
            el.alt = "";
            el.addEventListener("click", (e) => { e.stopPropagation(); window.open(img.url, "_blank"); });
            grid.appendChild(el);
        });
        body.appendChild(grid);
    }

    // Actions
    const liked = !!a.liked;
    const actions = document.createElement("div");
    actions.className = "tw-actions";

    const likeBtn = document.createElement("button");
    likeBtn.className = `tw-act like${liked ? " liked" : ""}`;
    likeBtn.dataset.aid   = a.aid;
    likeBtn.dataset.liked = liked ? "1" : "0";
    likeBtn.innerHTML = `<span class="li">${liked ? "♥" : "♡"}</span><span class="lc">${a.like_count}</span>`;
    likeBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleLike(likeBtn); });
    actions.appendChild(likeBtn);

    if (a.reply_count !== undefined) {
        const replySpan = document.createElement("span");
        replySpan.className = "tw-act";
        replySpan.innerHTML = `💬 <span>${a.reply_count}</span>`;
        actions.appendChild(replySpan);
    }

    const threadLink = document.createElement("a");
    threadLink.className = "tw-act";
    threadLink.href = `/article/${a.aid}`;
    threadLink.setAttribute("data-link", "");
    threadLink.textContent = "スレッド";
    actions.appendChild(threadLink);

    body.appendChild(actions);
    card.appendChild(body);
    return card;
}
