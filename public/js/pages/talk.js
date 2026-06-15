import { navigate } from "../router.js";
import { showNav } from "../nav.js";
import { escapeHtml } from "../renderUtils.js";

let activeEventSource = null;

export async function renderTalk(otherUid) {
    showNav("/messages");
    if (activeEventSource) { activeEventSource.close(); activeEventSource = null; }

    document.getElementById("app").innerHTML = `
        <div class="tw-header">
            <a class="tw-header-icon-btn" href="/messages" data-link title="戻る">←</a>
            <span class="tw-header-title" id="talkName">…</span>
        </div>
        <div class="tw-chat">
            <div class="tw-chat-msgs" id="chatMsgs"></div>
            <div class="tw-chat-bar">
                <input class="tw-chat-input" id="chatInput" placeholder="メッセージを入力…" autocomplete="off">
                <button class="tw-chat-send" id="chatSend">送信</button>
            </div>
        </div>
    `;

    const meRes = await fetch("/users/me");
    if (meRes.status === 401) { navigate("/sign"); return; }
    const { uid: myUid } = await meRes.json();

    // 相手ユーザー名
    const userRes = await fetch(`/users/${encodeURIComponent(otherUid)}`);
    if (userRes.ok) {
        const { user } = await userRes.json();
        const el = document.getElementById("talkName");
        if (el) el.textContent = user.name;
    }

    const msgsEl  = document.getElementById("chatMsgs");
    const input   = document.getElementById("chatInput");
    const sendBtn = document.getElementById("chatSend");

    function appendMsg(msg) {
        const mine = msg.sender_uid === myUid;
        const wrap = document.createElement("div");
        wrap.className = `tw-chat-msg-wrap ${mine ? "mine" : "theirs"}`;
        const bubble = document.createElement("div");
        bubble.className = `tw-chat-bubble ${mine ? "mine" : "theirs"}`;
        bubble.textContent = msg.content;
        wrap.appendChild(bubble);
        msgsEl.appendChild(wrap);
    }

    function scrollBottom() {
        msgsEl.scrollTop = msgsEl.scrollHeight;
    }

    // 既存メッセージ取得
    const res = await fetch(`/messages/${encodeURIComponent(otherUid)}`);
    if (res.status === 401) { navigate("/sign"); return; }
    const msgs = await res.json();
    msgs.forEach(appendMsg);
    scrollBottom();

    // 送信
    async function send() {
        const content = input.value.trim();
        if (!content) return;
        input.value = "";
        sendBtn.disabled = true;
        const r = await fetch(`/messages/${encodeURIComponent(otherUid)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
        });
        sendBtn.disabled = false;
        if (r.status === 401) { navigate("/sign"); return; }
        if (r.status === 403) { alert("このユーザーへのDMは許可されていません"); return; }
        if (r.ok) {
            const msg = await r.json();
            appendMsg(msg);
            scrollBottom();
        }
    }

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });

    // SSE でリアルタイム受信
    activeEventSource = new EventSource("/stream");
    activeEventSource.addEventListener("dm_message", (e) => {
        const msg = JSON.parse(e.data);
        if (msg.from_uid !== otherUid) return;
        appendMsg(msg);
        scrollBottom();
        // 既読にする
        fetch(`/messages/${encodeURIComponent(otherUid)}`);
    });
}
