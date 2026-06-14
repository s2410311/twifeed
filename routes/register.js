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

import { regenerateAuthenticatedSession } from "../service/sessionAuth.js";

import {
    bufferToBase64url,
    base64urlToBuffer,
    parseClientDataJSON
} from "../utils/webauthn.js";

const router = express.Router();

router.post("/options", async (req, res) => {
    try {
        const { uid, name, email } = req.body;

        if (!uid || typeof uid !== "string" || uid.trim() === "") {
            return res.status(400).json({ error: "invalid uid" });
        }
        if (!name || typeof name !== "string" || name.trim() === "") {
            return res.status(400).json({ error: "invalid name" });
        }
        if (!email || typeof email !== "string" || email.trim() === "") {
            return res.status(400).json({ error: "invalid email" });
        }

        if (db.prepare("SELECT uid FROM users WHERE uid = ?").get(uid.trim())) {
            return res.status(409).json({ error: "uid already taken" });
        }
        if (db.prepare("SELECT uid FROM users WHERE email = ?").get(email.trim())) {
            return res.status(409).json({ error: "email already taken" });
        }

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
            uid: uid.trim(),
            name: name.trim(),
            email: email.trim(),
            type: "registration",
            challenge: options.challenge
        });

        res.json(options);

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

router.post("/verify", async (req, res) => {
    let challenge;

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

        const cred = verification.registrationInfo.credential;

        db.prepare(`
            INSERT INTO users (uid, name, email, created_at)
            VALUES (?, ?, ?, ?)
        `).run(record.uid, record.name, record.email, Date.now());

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

        await regenerateAuthenticatedSession(req, res, record.uid);

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
