const clients = new Map(); // uid -> Set<Response>

export function addClient(uid, res) {
    if (!clients.has(uid)) clients.set(uid, new Set());
    clients.get(uid).add(res);
}

export function removeClient(uid, res) {
    const set = clients.get(uid);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) clients.delete(uid);
}

function send(res, event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function notifyUser(uid, event, data) {
    const set = clients.get(uid);
    if (!set) return;
    for (const res of set) send(res, event, data);
}

export function notifyAll(event, data) {
    for (const set of clients.values()) {
        for (const res of set) send(res, event, data);
    }
}
