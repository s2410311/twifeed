import { navigate } from "../router.js";
import { showNav } from "../nav.js";
import { escapeHtml, formatDate } from "../renderUtils.js";

export async function renderMessages() {
    showNav("/messages");

    document.getElementById("app").innerHTML = `
        <div class="tw-header">
            <span class="tw-header-logo">DM</span>
        </div>
        <div id="inboxList"></div>
    `;

    const [meRes, res] = await Promise.all([fetch("/users/me"), fetch("/messages")]);
    if (meRes.status === 401 || res.status === 401) { navigate("/sign"); return; }

    const { uid: myUid } = await meRes.json();
    const convos = await res.json();

    const container = document.getElementById("inboxList");
    if (!convos.length) {
        container.innerHTML = '<p class="tw-empty">メッセージはありません</p>';
        return;
    }

    for (const c of convos) {
        const item = document.createElement("div");
        item.className = "tw-inbox-item";
        item.addEventListener("click", () => navigate(`/talk/${encodeURIComponent(c.partner_uid)}`));

        const av = document.createElement("div");
        av.className = "tw-card-av";
        if (c.partner_icon) {
            const img = document.createElement("img");
            img.className = "tw-avatar"; img.src = c.partner_icon; img.alt = "";
            av.appendChild(img);
        } else {
            const ph = document.createElement("span");
            ph.className = "tw-avatar-ph";
            ph.textContent = c.partner_name.charAt(0).toUpperCase();
            av.appendChild(ph);
        }
        item.appendChild(av);

        const preview = document.createElement("div");
        preview.className = "tw-inbox-preview";
        const prefix = c.last_sender_uid === myUid ? "あなた: " : "";
        preview.innerHTML = `
            <div class="tw-inbox-name">${escapeHtml(c.partner_name)}</div>
            <div class="tw-inbox-last">${escapeHtml(prefix + c.last_content)}</div>
        `;
        item.appendChild(preview);

        const meta = document.createElement("div");
        meta.className = "tw-inbox-meta";
        meta.innerHTML = `<span class="tw-inbox-time">${formatDate(c.last_created_at)}</span>`;
        if (c.unread_count > 0) {
            const badge = document.createElement("span");
            badge.className = "tw-inbox-unread";
            badge.textContent = c.unread_count;
            meta.appendChild(badge);
        }
        item.appendChild(meta);

        container.appendChild(item);
    }
}
