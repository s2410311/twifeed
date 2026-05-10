export default function requireAuth(req,res,next) {
    if (!req.session || !req.session.uid) {
        return res.status(401).json({
            error: "unauthorized"
        });
    }

    next();
}