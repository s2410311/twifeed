import { navigate } from "../router.js";
import { showNav } from "../nav.js";

export function renderProfile() {
    showNav("/profile");

    document.getElementById("app").innerHTML = `
        <div class="tw-header">
            <span class="tw-header-logo">設定</span>
            <button class="tw-logout-btn" id="logoutBtn">ログアウト</button>
        </div>
        <div class="tw-page">

            <div class="tw-settings-sec">
                <p class="tw-settings-ttl">アイコン</p>
                <div class="tw-icon-row">
                    <div id="iconWrap">
                        <div id="iconPlaceholder" class="tw-profile-avatar-ph" style="width:64px;height:64px;font-size:22px">?</div>
                        <img id="iconImg" src="" alt="" class="tw-profile-avatar" style="width:64px;height:64px;display:none">
                    </div>
                    <div>
                        <label>
                            <input type="file" id="iconFile" accept="image/jpeg,image/png,image/webp" style="display:none">
                            <button type="button" class="tw-icon-pick-btn" id="iconPickBtn">画像を選択</button>
                        </label>
                        <button class="tw-icon-pick-btn" id="iconUploadBtn" style="display:none;margin-left:8px;background:var(--blue);color:#fff;border-color:var(--blue)">アップロード</button>
                        <p class="tw-settings-status" id="iconStatus"></p>
                    </div>
                </div>
            </div>

            <div class="tw-settings-sec">
                <p class="tw-settings-ttl">プロフィール</p>
                <div id="levelWrap" style="margin-bottom:14px"></div>
                <div class="tw-field-set">
                    <label>ユーザーID (@)</label>
                    <input id="uid" type="text" class="tw-settings-input">
                </div>
                <div class="tw-field-set">
                    <label>表示名</label>
                    <input id="name" type="text" class="tw-settings-input">
                </div>
                <div class="tw-field-set">
                    <label>メールアドレス</label>
                    <input id="email" type="email" class="tw-settings-input">
                </div>
                <div class="tw-field-set">
                    <label>所属学群</label>
                    <select id="department" class="tw-settings-input">
                        <option value="">未設定</option>
                        <option>人文・文化学群</option>
                        <option>社会・国際学群</option>
                        <option>人間学群</option>
                        <option>生命環境学群</option>
                        <option>情報学群</option>
                        <option>医学群</option>
                        <option>体育専門学群</option>
                        <option>芸術専門学群</option>
                        <option>総合学域群</option>
                    </select>
                </div>
                <button class="tw-save-btn" id="saveBtn">保存する</button>
                <p class="tw-settings-status" id="saveStatus"></p>
            </div>

            <div class="tw-settings-sec">
                <p class="tw-settings-ttl">フォロー中</p>
                <div id="followingList"></div>
            </div>

        </div>
    `;

    const saveStatus = document.getElementById("saveStatus");

    function showSaveStatus(msg, color) {
        saveStatus.textContent = msg;
        saveStatus.style.color = color;
        if (color === "green") setTimeout(() => { saveStatus.textContent = ""; }, 3000);
    }

    function setIcon(url, name) {
        const img  = document.getElementById("iconImg");
        const ph   = document.getElementById("iconPlaceholder");
        if (url) {
            img.src = url; img.style.display = ""; ph.style.display = "none";
        } else {
            img.style.display = "none"; ph.style.display = "flex";
            ph.textContent = (name ?? "?").charAt(0).toUpperCase();
        }
    }

    async function loadProfile() {
        const res = await fetch("/users/me");
        if (res.status === 401) { navigate("/sign"); return; }
        const user = await res.json();
        document.getElementById("uid").value        = user.uid        ?? "";
        document.getElementById("name").value       = user.name       ?? "";
        document.getElementById("email").value      = user.email      ?? "";
        document.getElementById("department").value = user.department ?? "";

        const levelWrap = document.getElementById("levelWrap");
        levelWrap.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px">
                <span class="tw-level-pill" style="margin-bottom:0">
                    レベル <strong>Lv.${user.level}</strong>
                    <span style="color:var(--text2)">次まで ${user.exp_to_next} exp</span>
                </span>
                <a href="/user/${encodeURIComponent(user.uid)}" data-link
                   style="font-size:0.85em;color:var(--blue);text-decoration:none">
                    自分のページを見る →
                </a>
            </div>
        `;
        setIcon(user.icon_url, user.name);
        await loadFollowing(user.uid);
    }

    const iconFile      = document.getElementById("iconFile");
    const iconPickBtn   = document.getElementById("iconPickBtn");
    const iconUploadBtn = document.getElementById("iconUploadBtn");
    const iconStatus    = document.getElementById("iconStatus");

    iconPickBtn.addEventListener("click", () => iconFile.click());
    iconFile.addEventListener("change", () => {
        if (!iconFile.files.length) return;
        setIcon(URL.createObjectURL(iconFile.files[0]), null);
        iconUploadBtn.style.display = "";
        iconStatus.textContent = iconFile.files[0].name;
        iconStatus.style.color = "var(--text2)";
    });
    iconUploadBtn.addEventListener("click", async () => {
        if (!iconFile.files.length) return;
        iconUploadBtn.disabled = true;
        iconStatus.textContent = "アップロード中…";
        const form = new FormData();
        form.append("icon", iconFile.files[0]);
        const r = await fetch("/users/me/icon", { method: "POST", body: form });
        iconUploadBtn.disabled = false;
        if (r.ok) {
            const { url } = await r.json();
            setIcon(url, null);
            iconUploadBtn.style.display = "none";
            iconFile.value = "";
            iconStatus.textContent = "アイコンを更新しました";
            iconStatus.style.color = "green";
            setTimeout(() => { iconStatus.textContent = ""; }, 3000);
        } else {
            const err = await r.json();
            iconStatus.textContent = "エラー: " + (err.error || r.status);
            iconStatus.style.color = "var(--danger)";
        }
    });

    async function loadFollowing(uid) {
        const res = await fetch(`/follows/${encodeURIComponent(uid)}/following`);
        const list = await res.json();
        const container = document.getElementById("followingList");
        container.innerHTML = "";
        if (!list.length) {
            container.innerHTML = '<p class="tw-empty" style="padding:16px 0">フォロー中のユーザーはいません</p>';
            return;
        }
        for (const u of list) {
            const item = document.createElement("div");
            item.className = "tw-follow-item";
            item.innerHTML = `
                <div class="tw-follow-info">
                    <a class="tw-follow-link" href="/user/${encodeURIComponent(u.uid)}" data-link>${u.name}</a>
                    <span class="tw-follow-uid-text">@${u.uid}</span>
                </div>
                <button class="tw-unfollow-btn">フォロー解除</button>
            `;
            item.querySelector(".tw-unfollow-btn").addEventListener("click", async () => {
                const r = await fetch(`/follows/${encodeURIComponent(u.uid)}`, { method: "DELETE" });
                if (r.ok) item.remove();
            });
            container.appendChild(item);
        }
    }

    async function save() {
        const uid        = document.getElementById("uid").value.trim();
        const name       = document.getElementById("name").value.trim();
        const email      = document.getElementById("email").value.trim();
        const department = document.getElementById("department").value || null;
        if (!uid)   { showSaveStatus("ユーザーIDを入力してください", "var(--danger)"); return; }
        if (!name)  { showSaveStatus("表示名を入力してください", "var(--danger)"); return; }
        if (!email) { showSaveStatus("メールアドレスを入力してください", "var(--danger)"); return; }
        const res = await fetch("/users/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid, name, email, department })
        });
        if (res.ok) { showSaveStatus("保存しました！", "green"); await loadProfile(); }
        else { const err = await res.json(); showSaveStatus("エラー: " + (err.error || res.status), "var(--danger)"); }
    }

    document.getElementById("saveBtn").addEventListener("click", save);
    document.getElementById("logoutBtn").addEventListener("click", async () => {
        await fetch("/logout", { method: "POST" });
        navigate("/sign");
    });

    loadProfile();
}
