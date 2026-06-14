import express from "express";
import {
    generateAuthenticationOptions,
    verifyAuthenticationResponse
} from "@simplewebauthn/server";

import {
    RP_ID,
    ORIGIN,
    RP_NAME
} from "../config/webauthn_config.js";

import db from "../db/index.js";

import {
    storeChallenge,
    getChallenge,
    consumeChallenge
} from "../lib/challenge.js";
import {
    storeSession,
    destroySession
} from "../lib/sessionStore.js";

import { regenerateAuthenticatedSession } from "../service/sessionAuth.js";

import {
    bufferToBase64url,
    base64urlToBuffer,
    parseClientDataJSON
} from "../utils/webauthn.js";
import { generateSessionId } from "../utils/generateSid.js";
import { buildSessionCookie } from "../lib/cookie.js";

const router = express.Router();

router.post("/options", async (req, res) => {
    try {
        console.log("auth/option,started");
        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            userVerification: "preferred"
        });


        await storeChallenge(options.challenge, {
            sessionID: req.session.sid,
            type: "authentication",
            challenge: options.challenge
        });

        res.json(options);
        console.log("auth/option,finished");

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

router.post("/verify", async (req, res) => {
    let challenge //challenge = clientData.challenge;

    try {
        const body = req.body;

        const clientData = parseClientDataJSON(
            body.response.clientDataJSON
        );
        if (!clientData) return res.json({ verified: false });

        challenge = clientData.challenge;

        const record = await getChallenge(challenge);

        if (!record || record.type !== "authentication") {
            return res.json({ verified: false });
        }


        const credID = base64urlToBuffer(body.rawId);

        const passkey = db.prepare(`
            SELECT * FROM passkeys WHERE credential_id = ?
        `).get(credID);

        if (!passkey) return res.json({ verified: false });

        console.log("passkey:", passkey);

        console.log("BODY:", JSON.stringify(req.body, null, 2));

        console.log("authenticator:", {
            credentialID: new Uint8Array(passkey.credential_id),
            credentialPublicKey: new Uint8Array(passkey.public_key),
            counter: passkey.sign_count
        });

        const verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge: record.challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            credential: {
                id: bufferToBase64url(passkey.credential_id),
                publicKey: passkey.public_key,
                counter: passkey.sign_count,
                transports: JSON.parse(passkey.transports || "[]")
            }
        });

        if (verification.verified) {
            db.prepare(`
                UPDATE passkeys
                SET sign_count = ?, last_used_at = ?
                WHERE credential_id = ?
            `).run(
                verification.authenticationInfo.newCounter,
                Date.now(),
                passkey.credential_id
            );

            await regenerateAuthenticatedSession(
                req,
                res,
                passkey.uid
            )
        }

        console.log("verification:", verification);
        res.json({ verified: verification.verified });


    } catch (e) {
        console.error(e);
        res.json({ verified: false });
    } finally {
        if (challenge) {
            await consumeChallenge(challenge);
        }
    }
});

export default router;