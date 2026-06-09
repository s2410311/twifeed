let nextOffset = null;

function formatDate(ts) {
    return new Date(ts).toLocaleString("ja-JP");
}

function renderArticle(a) {
    const div = document.createElement("div");
    div.style.borderBottom = "1px solid #ccc";
    div.style.padding = "8px 0";
    div.innerHTML = `
        <strong>${escapeHtml(a.name)}</strong>
        <span style="color:#888;font-size:0.85em"> @${escapeHtml(a.uid)} · ${formatDate(a.created_at)}</span>
        <p style="margin:4px 0">${escapeHtml(a.content)}</p>
    `;
    return div;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
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

    if (!content) {
        status.textContent = "内容を入力してください";
        return;
    }

    const res = await fetch("/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
    });

    if (res.status === 401) {
        window.location.href = "/sign.html";
        return;
    }

    if (res.status === 201) {
        document.getElementById("postContent").value = "";
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
