const logEl = document.getElementById("log");

function log(msg) {
    logEl.textContent += msg + "\n";
}

function bufferToBase64url(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBuffer(base64url) {
    const pad = "=".repeat((4 - base64url.length % 4) % 4);
    const base64 = (base64url + pad).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from([...atob(base64)].map(c => c.charCodeAt(0)));
}

function generateUid() {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(10)))
        .map(b => chars[b % chars.length]).join("");
    return `u_${rand}`;
}

/* =========================
   REGISTER
========================= */

async function register() {
    try {
        const name = document.getElementById("regName").value.trim();
        const email = document.getElementById("regEmail").value.trim();

        if (!name) { log("表示名を入力してください"); return; }
        if (!email) { log("メールアドレスを入力してください"); return; }

        const uid = generateUid();
        log(`登録開始（UID: ${uid}）`);

        const optRes = await fetch("/register/options", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid, name, email })
        });

        const options = await optRes.json();
        if (options.error) { log(options.error); return; }

        options.challenge = base64urlToBuffer(options.challenge);
        options.user.id = base64urlToBuffer(options.user.id);
        if (options.excludeCredentials) {
            options.excludeCredentials = options.excludeCredentials.map(
                c => ({ ...c, id: base64urlToBuffer(c.id) })
            );
        }

        const cred = await navigator.credentials.create({ publicKey: options });

        const attestation = {
            id: cred.id,
            rawId: bufferToBase64url(cred.rawId),
            type: cred.type,
            response: {
                clientDataJSON: bufferToBase64url(cred.response.clientDataJSON),
                attestationObject: bufferToBase64url(cred.response.attestationObject)
            }
        };

        const verifyRes = await fetch("/register/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(attestation)
        });

        const result = await verifyRes.json();
        if (result.verified) {
            window.location.href = "/";
        } else {
            log("登録失敗: 認証できませんでした");
        }

    } catch (e) {
        console.error(e);
        log("登録失敗");
    }
}

/* =========================
   LOGIN
========================= */

async function login() {
    try {
        log("ログイン開始");

        const optRes = await fetch("/auth/options", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });

        const options = await optRes.json();
        if (options.error) { log(options.error); return; }

        options.challenge = base64urlToBuffer(options.challenge);
        if (options.allowCredentials) {
            options.allowCredentials = options.allowCredentials.map(
                c => ({ ...c, id: base64urlToBuffer(c.id) })
            );
        }

        const cred = await navigator.credentials.get({ publicKey: options });

        const assertion = {
            id: cred.id,
            rawId: bufferToBase64url(cred.rawId),
            type: cred.type,
            response: {
                clientDataJSON: bufferToBase64url(cred.response.clientDataJSON),
                authenticatorData: bufferToBase64url(cred.response.authenticatorData),
                signature: bufferToBase64url(cred.response.signature),
                userHandle: cred.response.userHandle
                    ? bufferToBase64url(cred.response.userHandle) : null
            }
        };

        const verifyRes = await fetch("/auth/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(assertion)
        });

        const result = await verifyRes.json();
        if (result.verified) {
            window.location.href = "/";
            return;
        }

        log("ログイン失敗: 認証できませんでした");

    } catch (e) {
        console.error(e);
        log("ログイン失敗");
    }
}

document.getElementById("registerBtn").addEventListener("click", register);
document.getElementById("loginBtn").addEventListener("click", login);
