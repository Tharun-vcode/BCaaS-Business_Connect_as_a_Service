const express = require("express");
const router = express.Router();
const bcaasController = require("../controllers/bcaas.controller");
const verifyBcaasSignature = require("../middleware/bcaasAuth.middleware");

// Remove the extra "/bcaas" prefix from this line:
router.post("/auth/sso", verifyBcaasSignature, bcaasController.ssoLogin);

module.exports = router;