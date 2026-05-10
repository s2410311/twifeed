import { expiration_time } from "../config/session_config.js";

import redis from "./redisClient.js";


export async function storeSession(sid,session) {
    await redis.set(
        `session:${sid}`,
        JSON.stringify(session),
        "EX",
        expiration_time
    );
}

export async function getSession(sid) {
    const raw = await redis.get(
        `session:${sid}`
    );

    return raw
        ? JSON.parse(raw)
        : null;
}

export async function destroySession(sid) {
    await redis.del(`session:${sid}`);
}