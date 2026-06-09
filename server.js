import express from "express";

import "./db/init.js";

import {sessionMiddleware} from "./middleware/session.js";
import requireAuth from "./middleware/requireAuth.js";

import authRouter from "./routes/auth.js";
import registerRouter from "./routes/register.js";
import logoutRouter from "./routes/logout.js";
import articlesRouter from "./routes/articles.js";
import followsRouter from "./routes/follows.js";
import timelineRouter from "./routes/timeline.js";
import imagesRouter from "./routes/images.js";
import usersRouter from "./routes/users.js";

import { flushAllViews } from "./lib/views.js";
import { flushAllExp } from "./lib/exp.js";

const app = express();

app.use(express.json());
app.use(express.static("public"));

app.set("trust proxy", 1);

app.use(sessionMiddleware);

app.use("/auth", authRouter);
app.use("/register", registerRouter);
app.use("/logout", logoutRouter);
app.use("/articles", articlesRouter);
app.use("/follows", followsRouter);
app.use("/timeline", timelineRouter);
app.use("/images", imagesRouter);
app.use("/users", usersRouter);


const FLUSH_INTERVAL_MS = 60 * 1000; // 1分

setInterval(async () => {
    try {
        await flushAllViews();
        await flushAllExp();
    } catch (e) {
        console.error("flush error:", e);
    }
}, FLUSH_INTERVAL_MS);

app.listen(3000, () => {
    console.log("Server running");
});