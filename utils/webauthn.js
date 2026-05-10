export function bufferToBase64url(buffer) {
    return Buffer.from(buffer)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

export function base64urlToBuffer(base64url) {
    return Buffer.from(
        base64url
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(
                base64url.length +
                (4 - base64url.length % 4) % 4,
                "="
            ),
        "base64"
    );
}

export function parseClientDataJSON(base64url) {
    try {
        const buffer = base64urlToBuffer(base64url);
        return JSON.parse(buffer.toString());
    } catch {
        return null;
    }
}