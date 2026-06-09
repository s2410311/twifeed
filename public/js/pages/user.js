import { navigate } from "../router.js";
import { renderCard } from "../renderUtils.js";

export function renderUser(uid) {
    document.getElementById("app").innerHTML = `
        <a href="/" data-link>← ホームに戻る</a>
        <hr>
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:8px">
            <div id="userIconWrap"></div>
            <div>
                <h1 id="userName" style="margin:0"></h1>
                <p id="userUid" style="color:#888;margin:2px 0"></p>
            </div>
        </div>
        <p id="userStats"></p>
        <button id="followBtn" style="display:none"></button>
        <hr>
        <h2>投稿</h2>
        <div id="articles"></div>
    `;

    async function load() {
        const res = await fetch(`/users/${encodeURIComponent(uid)}`);
        if (res.status === 401) { navigate("/sign"); return; }
        if (res.status === 404) { document.getElementById("userName").textContent = "ユーザーが見つかりません"; return; }
        const { user, articles } = await res.json();

        document.title = `${user.name} - twifeed`;
        document.getElementById("userName").textContent  = user.name;
        document.getElementById("userUid").textContent   = `@${user.uid}`;
        document.getElementById("userStats").textContent = `フォロワー ${user.follower_count}　フォロー中 ${user.following_count}`;

        const iconWrap = document.getElementById("userIconWrap");
        if (user.icon_url) {
            const img = document.createElement("img");
            img.src = user.icon_url;
            img.alt = "";
            img.style.cssText = "width:64px;height:64px;border-radius:50%;object-fit:cover";
            iconWrap.appendChild(img);
        } else {
            const ph = document.createElement("div");
            ph.style.cssText = "width:64px;height:64px;border-radius:50%;background:#bbb;display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff;font-weight:bold";
            ph.textContent = user.name.charAt(0).toUpperCase();
            iconWrap.appendChild(ph);
        }

        const followBtn = document.getElementById("followBtn");
        followBtn.style.display = "inline";
        updateFollowBtn(followBtn, user.is_following);
        followBtn.addEventListener("click", () => toggleFollow(followBtn, user.uid));

        const container = document.getElementById("articles");
        for (const a of articles) {
            const card = renderCard(a, { showQuote: true });
            const link = document.createElement("a");
            link.href = `/article/${a.aid}`;
            link.setAttribute("data-link", "");
            link.textContent      = "詳細";
            link.style.cssText    = "font-size:0.85em;margin-left:8px";
            card.appendChild(link);
            container.appendChild(card);
        }
    }

    function updateFollowBtn(btn, isFollowing) {
        btn.textContent        = isFollowing ? "フォロー解除" : "フォローする";
        btn.dataset.following  = isFollowing ? "1" : "0";
    }

    async function toggleFollow(btn, targetUid) {
        const isFollowing = btn.dataset.following === "1";
        const res = await fetch(`/follows/${encodeURIComponent(targetUid)}`, {
            method: isFollowing ? "DELETE" : "POST"
        });
        if (res.status === 401) { navigate("/sign"); return; }
        if (res.ok) updateFollowBtn(btn, !isFollowing);
    }

    load();
}
