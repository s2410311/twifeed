import express from "express";
import {
    generateRegistrationOptions,
    verifyRegistrationResponse
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
    storeSession
} from "../lib/sessionStore.js"

import { regenerateAuthenticatedSession } from "../service/sessionAuth.js";

import {
    bufferToBase64url,
    base64urlToBuffer,
    parseClientDataJSON
} from "../utils/webauthn.js";

const router = express.Router();

router.post("/options", async (req, res) => {
    try {
        const { uid } = req.body;
        console.log(req.body);

        if (!uid || typeof uid !== "string") {
            return res.status(400).json({
                error: "invalid uid"
            });
        }

        db.prepare(`
            INSERT OR IGNORE INTO users (uid, email, created_at)
            VALUES (?, ?, ?)
        `).run(uid, "test@example.com", Date.now());

        const userIdBuffer = new TextEncoder().encode(uid);

        const existing = db.prepare(`
            SELECT credential_id FROM passkeys WHERE uid = ?
        `).all(uid);

        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: RP_ID,
            userID: userIdBuffer,
            userName: uid,
            excludeCredentials: existing.map(c => ({
                id: bufferToBase64url(c.credential_id),
                type: "public-key"
            }))
        });

        await storeChallenge(options.challenge, {
            sessionID: req.session.sid,
            uid,
            type: "registration",
            challenge: options.challenge
        });

        res.json(options);
        console.log("challenge発行:", options.challenge);

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

        if (!record || record.type !== "registration") {
            return res.json({ verified: false });
        }

        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge: record.challenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID
        });

        if (!verification.verified || !verification.registrationInfo) {
            return res.json({ verified: false });
        }

        if (record.sessionID !== req.session.sid) {
            return res.json({ verified: false });
        }

        const cred = verification.registrationInfo.credential;

        db.prepare(`
                INSERT INTO passkeys
                (uid, credential_id, public_key, sign_count, transports, backup_eligible, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
            record.uid,
            base64urlToBuffer(cred.id),
            Buffer.from(cred.publicKey),
            cred.counter,
            JSON.stringify(cred.transports || []),
            verification.registrationInfo.credentialBackedUp ? 1 : 0,
            Date.now()
        );

        await regenerateAuthenticatedSession(
            req,
            res,
            record.uid
        );

        console.log("受信challenge:", clientData?.challenge);
        console.log("DB record:", record);
        console.log("verification:", verification);
        res.json({ verified: true });

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