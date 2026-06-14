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
                <p id="userStats" style="margin:2px 0;font-size:0.9em;color:#555"></p>
            </div>
        </div>
        <button id="followBtn" style="display:none"></button>
        <hr>
        <h2 style="margin:8px 0">投稿</h2>
        <div id="articles"></div>
        <button id="moreBtn" style="display:none;margin-top:8px">もっと見る</button>
    `;

    let nextOffset = null;
    let myUid = null;

    function renderArticle(a) {
        const card = renderCard(a, { showQuote: true });
        const replyCount = document.createElement("span");
        replyCount.textContent = `💬 ${a.reply_count}`;
        replyCount.style.cssText = "font-size:0.85em;color:#888;margin-left:8px";
        const detailLink = document.createElement("a");
        detailLink.href = `/article/${a.aid}`;
        detailLink.setAttribute("data-link", "");
        detailLink.textContent = "詳細";
        detailLink.style.cssText = "font-size:0.85em;margin-left:8px";
        card.appendChild(replyCount);
        card.appendChild(detailLink);
        return card;
    }

    async function loadArticles(offset = 0, append = false) {
        const res = await fetch(`/users/${encodeURIComponent(uid)}?offset=${offset}&limit=20`);
        if (res.status === 401) { navigate("/sign"); return; }
        if (res.status === 404) {
            document.getElementById("userName").textContent = "ユーザーが見つかりません";
            return;
        }
        const { user, articles, next_offset } = await res.json();

        if (!append) {
            document.title = `${user.name} - twifeed`;
            document.getElementById("userName").textContent = user.name;
            document.getElementById("userUid").textContent = `@${user.uid}`;
            document.getElementById("userStats").textContent =
                `フォロワー ${user.follower_count}　フォロー中 ${user.following_count}`;

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
            if (myUid && myUid !== uid) {
                followBtn.style.display = "inline";
                updateFollowBtn(followBtn, user.is_following);
                followBtn.addEventListener("click", () => toggleFollow(followBtn, user.uid));
            }
        }

        const container = document.getElementById("articles");
        if (!append) container.innerHTML = "";
        if (articles.length === 0 && !append) {
            container.textContent = "投稿がありません";
        } else {
            articles.forEach(a => container.appendChild(renderArticle(a)));
        }

        nextOffset = next_offset;
        document.getElementById("moreBtn").style.display = nextOffset !== null ? "inline" : "none";
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
        if (res.status === 401) { navigate("/sign"); return; }
        if (res.ok) {
            updateFollowBtn(btn, !isFollowing);
            const stats = document.getElementById("userStats");
            const match = stats.textContent.match(/フォロワー (\d+)/);
            if (match) {
                const current = parseInt(match[1]);
                const newCount = isFollowing ? current - 1 : current + 1;
                stats.textContent = stats.textContent.replace(/フォロワー \d+/, `フォロワー ${newCount}`);
            }
        }
    }

    async function init() {
        const meRes = await fetch("/users/me");
        if (meRes.ok) {
            const me = await meRes.json();
            myUid = me.uid;
        }
        await loadArticles(0, false);
    }

    document.getElementById("moreBtn").addEventListener("click", () => loadArticles(nextOffset, true));

    init();
}
