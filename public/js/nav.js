let navEl = null;

export function showNav(activePath) {
    if (!navEl) {
        navEl = document.createElement("nav");
        navEl.className = "tw-bottom-nav";
        navEl.innerHTML = `
            <a class="tw-nav-btn" href="/"         data-link title="ホーム">🏠</a>
            <a class="tw-nav-btn" href="/search"   data-link title="検索">🔍</a>
            <a class="tw-nav-btn" href="/messages" data-link title="DM">✉️</a>
            <a class="tw-nav-btn" href="/profile"  data-link title="プロフィール">👤</a>
        `;
        document.body.appendChild(navEl);
    }
    navEl.style.display = "flex";
    navEl.querySelectorAll(".tw-nav-btn").forEach(btn => {
        const href = btn.getAttribute("href");
        btn.classList.toggle("active", href === activePath || (href !== "/" && activePath.startsWith(href)));
    });
}

export function hideNav() {
    if (navEl) navEl.style.display = "none";
}
