import { navigate } from "../router.js";

export function renderProfile() {
    document.getElementById("app").innerHTML = `
        <h1>プロフィール設定</h1>
        <a href="/" data-link>← ホームに戻る</a>
        <hr>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
            <div id="iconWrap" style="position:relative;width:80px;height:80px">
                <div id="iconPlaceholder" style="width:80px;height:80px;border-radius:50%;background:#bbb;display:flex;align-items:center;justify-content:center;font-size:32px;color:#fff;font-weight:bold">?</div>
                <img id="iconImg" src="" alt="アイコン" style="width:80px;height:80px;border-radius:50%;object-fit:cover;display:none">
            </div>
            <div>
                <label style="cursor:pointer">
                    <input type="file" id="iconFile" accept="image/jpeg,image/png,image/webp" style="display:none">
                    <button type="button" id="iconPickBtn">アイコン画像を選択</button>
                </label>
                <button id="iconUploadBtn" style="display:none;margin-left:8px">アップロード</button>
                <p id="iconStatus" style="margin:4px 0;font-size:0.85em"></p>
            </div>
        </div>
        <hr>
        <p>レベル: <strong id="level">-</strong> &nbsp; <span id="exp_to_next" style="color:#888;font-size:0.9em"></span></p>
        <p><label>ユーザーID (@): <input id="uid" type="text"></label></p>
        <p><label>表示名: <input id="name" type="text"></label></p>
        <p><label>メールアドレス: <input id="email" type="email"></label></p>
        <button id="saveBtn">保存</button>
        <p id="status"></p>
        <hr>
        <h2>フォロー中</h2>
        <div id="followingList"></div>
    `;

    const statusEl = document.getElementById("status");

    function showStatus(msg, color) {
        statusEl.textContent = msg;
        statusEl.style.color = color;
        statusEl.style.fontWeight = color === "green" ? "bold" : "";
        if (color === "green") {
            setTimeout(() => { statusEl.textContent = ""; statusEl.style.cssText = ""; }, 3000);
        }
    }

    function setIcon(url, name) {
        const img = document.getElementById("iconImg");
        const placeholder = document.getElementById("iconPlaceholder");
        if (url) {
            img.src = url;
            img.style.display = "";
            placeholder.style.display = "none";
        } else {
            img.style.display = "none";
            placeholder.style.display = "flex";
            placeholder.textContent = (name ?? "?").charAt(0).toUpperCase();
        }
    }

    async function loadProfile() {
        const res = await fetch("/users/me");
        if (res.status === 401) { navigate("/sign"); return; }
        const user = await res.json();
        document.getElementById("uid").value   = user.uid   ?? "";
        document.getElementById("name").value  = user.name  ?? "";
        document.getElementById("email").value = user.email ?? "";
        document.getElementById("level").textContent     = `Lv.${user.level}`;
        document.getElementById("exp_to_next").textContent = `次のレベルまで ${user.exp_to_next} exp`;
        setIcon(user.icon_url, user.name);
        await loadFollowing(user.uid);
    }

    const iconFile = document.getElementById("iconFile");
    const iconPickBtn = document.getElementById("iconPickBtn");
    const iconUploadBtn = document.getElementById("iconUploadBtn");
    const iconStatus = document.getElementById("iconStatus");

    iconPickBtn.addEventListener("click", () => iconFile.click());

    iconFile.addEventListener("change", () => {
        if (iconFile.files.length === 0) return;
        const file = iconFile.files[0];
        const previewUrl = URL.createObjectURL(file);
        setIcon(previewUrl, null);
        iconUploadBtn.style.display = "";
        iconStatus.textContent = `${file.name} を選択中`;
        iconStatus.style.color = "#555";
    });

    iconUploadBtn.addEventListener("click", async () => {
        if (iconFile.files.length === 0) return;
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
            iconStatus.style.color = "red";
        }
    });

    async function loadFollowing(uid) {
        const res = await fetch(`/follows/${encodeURIComponent(uid)}/following`);
        const list = await res.json();
        const container = document.getElementById("followingList");
        container.innerHTML = "";
        if (list.length === 0) { container.textContent = "フォロー中のユーザーはいません"; return; }
        for (const u of list) {
            const div = document.createElement("div");
            div.style.cssText = "padding:6px 0;border-bottom:1px solid #eee;display:flex;align-items:center;gap:8px";
            const link = document.createElement("a");
            link.href = `/user/${encodeURIComponent(u.uid)}`;
            link.setAttribute("data-link", "");
            link.textContent = `${u.name} @${u.uid}`;
            const unfollowBtn = document.createElement("button");
            unfollowBtn.textContent = "フォロー解除";
            unfollowBtn.addEventListener("click", async () => {
                const r = await fetch(`/follows/${encodeURIComponent(u.uid)}`, { method: "DELETE" });
                if (r.ok) div.remove();
            });
            div.appendChild(link);
            div.appendChild(unfollowBtn);
            container.appendChild(div);
        }
    }

    async function save() {
        const uid   = document.getElementById("uid").value.trim();
        const name  = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        if (!uid)   { showStatus("ユーザーIDを入力してください", "red"); return; }
        if (!name)  { showStatus("表示名を入力してください", "red"); return; }
        if (!email) { showStatus("メールアドレスを入力してください", "red"); return; }
        const res = await fetch("/users/me", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid, name, email })
        });
        if (res.ok) { showStatus("保存しました！", "green"); await loadProfile(); }
        else { const err = await res.json(); showStatus("エラー: " + (err.error || res.status), "red"); }
    }

    document.getElementById("saveBtn").addEventListener("click", save);
    loadProfile();
}
