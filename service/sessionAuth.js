import {
    destroySession,
    storeSession
} from "../lib/sessionStore.js";
import {buildSessionCookie} from "../lib/cookie.js";

import {
    generateSessionId
} from "../utils/generateSid.js";


export async function
regenerateAuthenticatedSession(req,res,uid) {
    await destroySession(req.sessionID);

    const newSID =generateSessionId();

    await storeSession(
        newSID,
        { uid }
    );

    res.setHeader(
        "Set-Cookie",
        buildSessionCookie(newSID)
    );
}