import express from "express";

import "./db/init.js";

import {sessionMiddleware} from "./middleware/session.js";
import requireAuth from "./middleware/requireAuth.js";

import authRouter from "./routes/auth.js";
import registerRouter from "./routes/register.js";
import logoutRouter from "./routes/logout.js";

const app = express();

app.use(express.json());
app.use(express.static("public"));

app.set("trust proxy", 1);

app.use(sessionMiddleware);

app.use("/auth", authRouter);
app.use("/register", registerRouter);
app.use("/logout", logoutRouter);


app.listen(3000, () => {
    console.log("Server running");
});