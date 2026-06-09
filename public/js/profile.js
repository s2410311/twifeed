const uidInput   = document.getElementById("uid");
const nameInput  = document.getElementById("name");
const emailInput = document.getElementById("email");
const status     = document.getElementById("status");

async function loadProfile() {
    const res = await fetch("/users/me");
    if (res.status === 401) { window.location.href = "/sign.html"; return; }
    const user = await res.json();
    uidInput.value   = user.uid   ?? "";
    nameInput.value  = user.name  ?? "";
    emailInput.value = user.email ?? "";
    document.getElementById("level").textContent = `Lv.${user.level}`;
    document.getElementById("exp_to_next").textContent = `次のレベルまで ${user.exp_to_next} exp`;
    await loadFollowing(user.uid);
}

async function loadFollowing(uid) {
    const res = await fetch(`/follows/${encodeURIComponent(uid)}/following`);
    const list = await res.json();
    const container = document.getElementById("followingList");
    container.innerHTML = "";

    if (list.length === 0) {
        container.textContent = "フォロー中のユーザーはいません";
        return;
    }

    for (const u of list) {
        const div = document.createElement("div");
        div.style.padding = "6px 0";
        div.style.borderBottom = "1px solid #eee";
        div.style.display = "flex";
        div.style.alignItems = "center";
        div.style.gap = "8px";

        const link = document.createElement("a");
        link.href = `/user.html?uid=${encodeURIComponent(u.uid)}`;
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
    const uid   = uidInput.value.trim();
    const name  = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (!uid)   { showStatus("ユーザーIDを入力してください", "red"); return; }
    if (!name)  { showStatus("表示名を入力してください", "red"); return; }
    if (!email) { showStatus("メールアドレスを入力してください", "red"); return; }

    const res = await fetch("/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, name, email })
    });

    if (res.ok) {
        showStatus("保存しました！", "green");
        // UID変更後にプリフィルを最新化
        await loadProfile();
    } else {
        const err = await res.json();
        showStatus("エラー: " + (err.error || res.status), "red");
    }
}

function showStatus(msg, color) {
    status.textContent = msg;
    status.style.color = color;
    status.style.fontWeight = color === "green" ? "bold" : "";
    if (color === "green") {
        setTimeout(() => {
            status.textContent = "";
            status.style.color = "";
            status.style.fontWeight = "";
        }, 3000);
    }
}

document.getElementById("saveBtn").addEventListener("click", save);

loadProfile();
