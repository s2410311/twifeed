import { navigate } from "./router.js";

export function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function formatDate(ts) {
    return new Date(ts).toLocaleString("ja-JP");
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
        const count = parseInt(btn.textContent.replace(/\D/g, "")) + (newLiked ? 1 : -1);
        btn.dataset.liked = newLiked ? "1" : "0";
        btn.textContent = `${newLiked ? "♥" : "♡"} ${count}`;
    }
}

export function renderCard(a, { showQuote = true } = {}) {
    const div = document.createElement("div");
    div.style.borderBottom = "1px solid #ccc";
    div.style.padding = "8px 0";

    const liked = !!a.liked;
    const likeBtn = document.createElement("button");
    likeBtn.textContent = `${liked ? "♥" : "♡"} ${a.like_count}`;
    likeBtn.dataset.aid = a.aid;
    likeBtn.dataset.liked = liked ? "1" : "0";
    likeBtn.addEventListener("click", () => toggleLike(likeBtn));

    const quote = (showQuote && a.parent_aid) ? `
        <div style="border:1px solid #ccc;border-radius:4px;padding:6px;margin-bottom:6px;color:#555;font-size:0.9em">
            <strong>${escapeHtml(a.parent_name ?? "")}</strong>
            <span style="color:#aaa"> @${escapeHtml(a.parent_uid ?? "")}</span>
            <p style="margin:2px 0">${escapeHtml((a.parent_content ?? "").slice(0, 100))}${(a.parent_content ?? "").length > 100 ? "…" : ""}</p>
        </div>
    ` : "";

    const avatarStyle = "width:36px;height:36px;border-radius:50%;object-fit:cover;margin-right:8px;vertical-align:middle;flex-shrink:0";
    const avatarEl = a.icon_url
        ? `<img src="${escapeHtml(a.icon_url)}" style="${avatarStyle}" alt="">`
        : `<span style="${avatarStyle};background:#bbb;display:inline-flex;align-items:center;justify-content:center;font-size:15px;color:#fff;font-weight:bold">${escapeHtml(a.name.charAt(0).toUpperCase())}</span>`;

    div.innerHTML = `
        ${quote}
        <div style="display:flex;align-items:flex-start;gap:0">
            <a href="/user/${encodeURIComponent(a.uid)}" data-link style="display:inline-flex">${avatarEl}</a>
            <div style="flex:1;min-width:0">
                <strong><a href="/user/${encodeURIComponent(a.uid)}" data-link style="color:inherit;text-decoration:none">${escapeHtml(a.name)}</a></strong>
                <span style="color:#888;font-size:0.85em"> @${escapeHtml(a.uid)} · ${formatDate(a.created_at)}</span>
                ${a.category_name ? `<span style="font-size:0.75em;background:#eef;color:#66a;border-radius:4px;padding:1px 6px;margin-left:4px">${escapeHtml(a.category_name)}</span>` : ""}
                <p style="margin:4px 0;white-space:pre-wrap">${linkifyTags(a.content)}</p>
            </div>
        </div>
    `;

    if (a.images?.length > 0) {
        const imgWrap = document.createElement("div");
        for (const img of a.images) {
            const el = document.createElement("img");
            el.src = img.thumbnail_url;
            el.alt = "";
            el.style.cssText = "max-width:200px;max-height:200px;margin-right:4px;cursor:pointer";
            el.addEventListener("click", () => window.open(img.url, "_blank"));
            imgWrap.appendChild(el);
        }
        div.appendChild(imgWrap);
    }

    div.appendChild(likeBtn);
    return div;
}
