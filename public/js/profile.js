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
    document.getElementById("exp").textContent = user.exp ?? 0;
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
