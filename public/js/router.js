const routes = [];

function matchRoute(pattern, pathname) {
    const patParts = pattern.split("/");
    const pathParts = pathname.split("/");
    if (patParts.length !== pathParts.length) return null;
    const params = {};
    for (let i = 0; i < patParts.length; i++) {
        if (patParts[i].startsWith(":")) {
            params[patParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
        } else if (patParts[i] !== pathParts[i]) {
            return null;
        }
    }
    return params;
}

export function route(pattern, handler) {
    routes.push({ pattern, handler });
}

export function navigate(path) {
    history.pushState({}, "", path);
    dispatch(location.pathname);
}

export function dispatch(pathname) {
    for (const { pattern, handler } of routes) {
        const match = matchRoute(pattern, pathname);
        if (match !== null) {
            document.getElementById("app").innerHTML = "";
            handler(match);
            return;
        }
    }
    document.getElementById("app").innerHTML = "<p>ページが見つかりません</p>";
}

// data-link 属性のある <a> をSPA遷移に変換
document.addEventListener("click", (e) => {
    const link = e.target.closest("a[data-link]");
    if (link) {
        e.preventDefault();
        navigate(link.getAttribute("href"));
    }
});

window.addEventListener("popstate", () => dispatch(location.pathname));
