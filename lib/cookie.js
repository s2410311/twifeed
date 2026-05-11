import {
    COOKIE_OPTIONS
} from "../config/cookie_policy.js";

export function
buildSessionCookie(sid) {

    return (
        `sid=${sid}; ` +
        COOKIE_OPTIONS
    );
}

export function
clearSessionCookie() {

    return (
        `sid=; ` +
        COOKIE_OPTIONS + "; " +
        `Max-Age=0`
    );
}