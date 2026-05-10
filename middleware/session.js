import crypto from "crypto";

import { expiration_time } from "../config/session_config.js";

import redis from "../lib/redisClient.js";
import {
    getSession,
} from "../lib/sessionStore.js"

import {
    buildSessionCookie
} from "../lib/cookie.js";
import { expiration_time } from "../config/session_config.js";

function parseCookies(req) {
    const header = req.headers.cookie || "";
    return Object.fromEntries(
        header.split(";").map(v => v.trim().split("="))
    );
}

export async function sessionMiddleware(req, res, next) {

    const cookies = parseCookies(req);

    let sid = cookies.sid;
    console.log("sid before:", sid);

    if (!sid) {
        sid = generateSessionId();

        await redis.set(
            `session:${sid}`,
            JSON.stringify({ uid: null }),
            "EX",
            expiration_time
        );

        res.setHeader(
            "Set-Cookie",
            buildSessionCookie(sid)
        );
        console.log("Set-Cookie issued");
    }

    const session = await getSession(sid);

    req.session = session || { uid: null };
    req.session.sid = sid;

    next();
}

/*
sessionMiddlewareをimportして、app.use(sessionMiddleware);すると、req.session.uidでuidを指定できる。
 */