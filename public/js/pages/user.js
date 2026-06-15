import { navigate } from "../router.js";
import { renderCard, escapeHtml } from "../renderUtils.js";
import { showNav } from "../nav.js";

export function renderUser(uid) {
    showNav("/");

    document.getElementById("app").innerHTML = `
        <div class="tw-header">
            <a class="tw-header-icon-btn" href="/" data-link title="戻る">←</a>
            <span class="tw-header-title" id="headerName">ユーザー</span>
        </div>

        <div class="tw-iprofile">
            <div class="tw-iprofile-top">
                <div id="avatarWrap"></div>
                <div class="tw-iprofile-stats">
                    <div class="tw-iprofile-stat">
                        <strong id="postCount">—</strong><span>投稿</span>
                    </div>
                    <div class="tw-iprofile-stat tw-iprofile-stat--btn" id="statFollowers">
                        <strong id="followerNum">—</strong><span>フォロワー</span>
                    </div>
                    <div class="tw-iprofile-stat tw-iprofile-stat--btn" id="statFollowing">
                        <strong id="followingNum">—</strong><span>フォロー中</span>
                    </div>
                </div>
            </div>

            <p class="tw-iprofile-name" id="profileName"></p>
            <p class="tw-profile-uid"   id="profileUid"></p>

            <div class="tw-profile-badges" id="profileBadges">
                <span class="tw-profile-role" id="profileRole" style="display:none"></span>
                <span class="tw-profile-dept" id="profileDept" style="display:none"></span>
                <span class="tw-level-pill"   id="levelPill"   style="display:none"></span>
            </div>

            <div class="tw-iprofile-btns" id="profileBtns" style="display:none">
                <button class="tw-talk-btn"   id="talkBtn"   style="display:none">トーク</button>
                <button class="tw-follow-btn" id="followBtn" style="display:none"></button>
            </div>
        </div>

        <div id="userListWrap"></div>
        <div class="tw-tabs" id="postTabs" style="display:none">
            <button class="tw-tab active" id="tabPosts">投稿</button>
            <button class="tw-tab"        id="tabFollowers">フォロワー</button>
            <button class="tw-tab"        id="tabFollowing">フォロー中</button>
        </div>
        <div class="tw-page" id="posts"></div>
        <button class="tw-more" id="moreBtn" style="display:none">もっと見る</button>
    `;

    let nextOffset = null;
    let myUid = null;
    let activeList = "posts";
    let followerCount = 0;
    let profileInitialized = false;

    async function loadPosts(offset = 0, append = false) {
        const res = await fetch(`/users/${encodeURIComponent(uid)}?offset=${offset}&limit=20`);
        if (res.status === 401) { navigate("/sign"); return; }
        if (res.status === 404) {
            document.getElementById("profileName").textContent = "ユーザーが見つかりません";
            return;
        }
        const { user, articles, next_offset } = await res.json();
        followerCount = user.follower_count;

        if (!append) {
            document.title = `${user.name} - TwiFeed`;
            document.getElementById("headerName").textContent  = user.name;
            document.getElementById("profileName").textContent = user.name;
            document.getElementById("profileUid").textContent  = `@${user.uid}`;
            document.getElementById("postCount").textContent   = user.post_count ?? "—";
            document.getElementById("followerNum").textContent = user.follower_count;
            document.getElementById("followingNum").textContent = user.following_count;

            const roleEl = document.getElementById("profileRole");
            roleEl.textContent   = user.role ?? "";
            roleEl.style.display = user.role ? "" : "none";

            const deptEl = document.getElementById("profileDept");
            deptEl.textContent   = user.department ?? "";
            deptEl.style.display = user.department ? "" : "none";

            const levelEl = document.getElementById("levelPill");
            levelEl.innerHTML    = `Lv.<strong>${user.level}</strong>`;
            levelEl.style.display = "";

            // トークボタン（can_dm はフォロー状態で変わるため毎回更新）
            const talkBtn = document.getElementById("talkBtn");
            if (myUid && myUid !== uid && user.can_dm) {
                talkBtn.style.display = "";
                talkBtn.onclick = () => navigate(`/talk/${encodeURIComponent(uid)}`);
            } else {
                talkBtn.style.display = "none";
            }

            if (!profileInitialized) {
                profileInitialized = true;

                // Avatar
                const wrap = document.getElementById("avatarWrap");
                if (user.icon_url) {
                    const img = document.createElement("img");
                    img.className = "tw-iprofile-avatar";
                    img.src = user.icon_url;
                    img.alt = "";
                    wrap.appendChild(img);
                } else {
                    const ph = document.createElement("div");
                    ph.className = "tw-iprofile-avatar-ph";
                    ph.textContent = user.name.charAt(0).toUpperCase();
                    wrap.appendChild(ph);
                }

                // フォローボタン
                const btn = document.getElementById("followBtn");
                if (myUid && myUid !== uid) {
                    btn.style.display = "";
                    updateFollowBtn(btn, user.is_following);
                    btn.addEventListener("click", () => toggleFollow(btn, user.uid));
                }

                // スタットクリック
                document.getElementById("statFollowers").addEventListener("click", () => switchList("followers"));
                document.getElementById("statFollowing").addEventListener("click", () => switchList("following"));
            }

            // ボタン行は他ユーザーのみ表示
            if (myUid && myUid !== uid) {
                document.getElementById("profileBtns").style.display = "flex";
            }

            document.getElementById("postTabs").style.display = "flex";
        }

        const container = document.getElementById("posts");
        if (!append) container.innerHTML = "";
        if (articles.length === 0 && !append) {
            container.innerHTML = '<p class="tw-empty">投稿がありません</p>';
        } else {
            articles.forEach(a => container.appendChild(renderCard(a)));
        }
        nextOffset = next_offset;
        document.getElementById("moreBtn").style.display = nextOffset !== null ? "block" : "none";
    }

    async function loadUserList(type) {
        const res = await fetch(`/follows/${encodeURIComponent(uid)}/${type}`);
        if (!res.ok) return;
        const list = await res.json();
        const container = document.getElementById("posts");
        container.innerHTML = "";
        document.getElementById("moreBtn").style.display = "none";
        if (!list.length) {
            container.innerHTML = `<p class="tw-empty">${type === "followers" ? "フォロワーはいません" : "フォロー中のユーザーはいません"}</p>`;
            return;
        }
        for (const u of list) {
            const item = document.createElement("div");
            item.className = "tw-follow-item";

            const avLink = document.createElement("a");
            avLink.className = "tw-card-av";
            avLink.href = `/user/${encodeURIComponent(u.uid)}`;
            avLink.setAttribute("data-link", "");
            if (u.icon_url) {
                const img = document.createElement("img");
                img.className = "tw-avatar"; img.src = u.icon_url; img.alt = "";
                avLink.appendChild(img);
            } else {
                const ph = document.createElement("span");
                ph.className = "tw-avatar-ph";
                ph.textContent = u.name.charAt(0).toUpperCase();
                avLink.appendChild(ph);
            }
            item.appendChild(avLink);

            const info = document.createElement("div");
            info.className = "tw-follow-info";
            info.style.cssText = "flex:1;min-width:0";
            info.innerHTML = `
                <a class="tw-follow-link" href="/user/${encodeURIComponent(u.uid)}" data-link>${escapeHtml(u.name)}</a>
                <span class="tw-follow-uid-text">@${escapeHtml(u.uid)}</span>
            `;
            item.appendChild(info);

            if (myUid && myUid !== u.uid) {
                let following = !!u.is_following;
                const btn = document.createElement("button");
                function updateBtn() {
                    btn.textContent = following ? "フォロー解除" : "フォローバック";
                    btn.className   = following ? "tw-unfollow-btn" : "tw-followback-btn";
                }
                updateBtn();
                btn.addEventListener("click", async () => {
                    const r = await fetch(`/follows/${encodeURIComponent(u.uid)}`, {
                        method: following ? "DELETE" : "POST"
                    });
                    if (r.status === 401) { navigate("/sign"); return; }
                    if (r.ok) { following = !following; updateBtn(); }
                });
                item.appendChild(btn);
            }

            container.appendChild(item);
        }
    }

    function switchList(type) {
        activeList = type;
        ["tabPosts", "tabFollowers", "tabFollowing"].forEach(id =>
            document.getElementById(id)?.classList.remove("active")
        );
        if (type === "posts") {
            document.getElementById("tabPosts").classList.add("active");
            loadPosts(0, false);
        } else if (type === "followers") {
            document.getElementById("tabFollowers").classList.add("active");
            loadUserList("followers");
        } else {
            document.getElementById("tabFollowing").classList.add("active");
            loadUserList("following");
        }
    }

    function updateFollowBtn(btn, isFollowing) {
        btn.textContent = isFollowing ? "フォロー解除" : "フォローする";
        btn.classList.toggle("following", isFollowing);
    }

    async function toggleFollow(btn, targetUid) {
        const isFollowing = btn.classList.contains("following");
        const res = await fetch(`/follows/${encodeURIComponent(targetUid)}`, {
            method: isFollowing ? "DELETE" : "POST"
        });
        if (res.status === 401) { navigate("/sign"); return; }
        if (res.ok) {
            updateFollowBtn(btn, !isFollowing);
            followerCount += isFollowing ? -1 : 1;
            const el = document.getElementById("followerNum");
            if (el) el.textContent = followerCount;
        }
    }

    document.getElementById("moreBtn").addEventListener("click", () => loadPosts(nextOffset, true));
    document.getElementById("tabPosts")?.addEventListener("click",     () => switchList("posts"));
    document.getElementById("tabFollowers")?.addEventListener("click", () => switchList("followers"));
    document.getElementById("tabFollowing")?.addEventListener("click", () => switchList("following"));

    async function init() {
        const meRes = await fetch("/users/me");
        if (meRes.ok) myUid = (await meRes.json()).uid;
        await loadPosts(0, false);
    }
    init();
}
