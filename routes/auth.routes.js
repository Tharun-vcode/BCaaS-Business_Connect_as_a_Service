require("../models/bcaasClient.model");
require("../models/bcaasUserMapping.model");
const express = require("express");
const router = express.Router();
const auth = require("../controllers/auth.controller");

const { webAuthenticateToken } = require("../middleware/webAuthJwt");
const loginLimiter = require("../middleware/loginRateLimit");

router.post("/auth/web-login",loginLimiter, auth.web_login);

router.post("/auth/web-logout", auth.web_logout);

router.get("/web-profile", webAuthenticateToken, auth.web_getProfile);

router.post("/auth/forgot-password", auth.forgotPassword);

router.post("/auth/verify-otp/forgot-otp", auth.verifyForgotPasswordOTP);

router.put("/auth/resend-otp/forgot/:userId", auth.resendForgotPasswordOTP);

router.post("/auth/update-password", auth.updatePassword);

module.exports = router;
