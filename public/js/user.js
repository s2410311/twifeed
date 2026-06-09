import { renderCard } from "./renderUtils.js";

const uid = new URLSearchParams(location.search).get("uid") ?? "";

async function load() {
    const res = await fetch(`/users/${encodeURIComponent(uid)}`);
    if (res.status === 401) { window.location.href = "/sign.html"; return; }
    if (res.status === 404) { document.getElementById("userName").textContent = "ユーザーが見つかりません"; return; }

    const { user, articles } = await res.json();

    document.title = `${user.name} - twifeed`;
    document.getElementById("userName").textContent = user.name;
    document.getElementById("userUid").textContent = `@${user.uid}`;
    document.getElementById("userStats").textContent =
        `フォロワー ${user.follower_count}　フォロー中 ${user.following_count}`;

    const followBtn = document.getElementById("followBtn");
    followBtn.style.display = "inline";
    updateFollowBtn(followBtn, user.is_following);
    followBtn.addEventListener("click", () => toggleFollow(followBtn, user.uid));

    const container = document.getElementById("articles");
    for (const a of articles) {
        const card = renderCard(a, { showQuote: true });
        const link = document.createElement("a");
        link.href = `/article.html?aid=${a.aid}`;
        link.textContent = "詳細";
        link.style.fontSize = "0.85em";
        link.style.marginLeft = "8px";
        card.appendChild(link);
        container.appendChild(card);
    }
}

function updateFollowBtn(btn, isFollowing) {
    btn.textContent = isFollowing ? "フォロー解除" : "フォローする";
    btn.dataset.following = isFollowing ? "1" : "0";
}

async function toggleFollow(btn, targetUid) {
    const isFollowing = btn.dataset.following === "1";
    const res = await fetch(`/follows/${encodeURIComponent(targetUid)}`, {
        method: isFollowing ? "DELETE" : "POST"
    });
    if (res.status === 401) { window.location.href = "/sign.html"; return; }
    if (res.ok) updateFollowBtn(btn, !isFollowing);
}

load();
