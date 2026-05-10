import Redis from "ioredis";
import {
    host,
    port
} from "../config/redis_config.js";

const redis = new Redis({
    host: host,
    port: port
});

export default redis;