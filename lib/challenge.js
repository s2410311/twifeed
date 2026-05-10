import redis from "./redisClient.js";
const CHALLENGE_TTL = 60; // 秒

export async function storeChallenge(challenge, data) {
    await redis.set(
        `challenge:${challenge}`,
        JSON.stringify(data),
        "EX",
        CHALLENGE_TTL
    );
}

export async function getChallenge(challenge) {
    const data = await redis.get(`challenge:${challenge}`);
    return data ? JSON.parse(data) : null;
}

export async function consumeChallenge(challenge) {
    await redis.del(`challenge:${challenge}`);
}
