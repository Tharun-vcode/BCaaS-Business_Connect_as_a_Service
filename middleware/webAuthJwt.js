const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET_KEY || "supersecret";

function webAuthenticateToken(req, res, next) {
    const token = req.cookies.nbc_web_token; // Read from cookie
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}
module.exports = {
    webAuthenticateToken: webAuthenticateToken,
};
