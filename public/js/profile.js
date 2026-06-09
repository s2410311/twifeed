const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const status = document.getElementById("status");

async function loadProfile() {
    const res = await fetch("/users/me");
    if (res.status === 401) {
        window.location.href = "/sign.html";
        return;
    }
    const user = await res.json();
    nameInput.value = user.name ?? "";
    emailInput.value = user.email ?? "";
}

async function save() {
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (!name) {
        status.textContent = "名前を入力してください";
        status.style.color = "red";
        return;
    }
    if (!email) {
        status.textContent = "メールアドレスを入力してください";
        status.style.color = "red";
        return;
    }

    const res = await fetch("/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email })
    });

    if (res.ok) {
        status.textContent = "保存しました！";
        status.style.color = "green";
        status.style.fontWeight = "bold";
        setTimeout(() => {
            status.textContent = "";
            status.style.color = "";
            status.style.fontWeight = "";
        }, 3000);
    } else {
        const err = await res.json();
        status.textContent = "エラー: " + (err.error || res.status);
        status.style.color = "red";
    }
}

document.getElementById("saveBtn").addEventListener("click", save);

loadProfile();
