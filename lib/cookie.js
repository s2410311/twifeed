import { isProd }
from "../config/env.js";

export function buildSessionCookie(sid) {
    return (
        `sid=${sid}; ` +
        `HttpOnly; ` +
        `Path=/; ` +
        `SameSite=Lax` +
        (isProd ? "; Secure" : "")
    );
}

export function clearSessionCookie() {

    return (
        `sid=; ` +
        `HttpOnly; ` +
        `Path=/; ` +
        `SameSite=Lax; ` +
        `Max-Age=0` +
        (isProd ? "; Secure" : "")
    );
}