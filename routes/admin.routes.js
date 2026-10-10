const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { webAuthenticateToken } = require('../middleware/webAuthJwt'); // ← correct name

router.post('/admin/onboard', webAuthenticateToken, adminController.onboardAdmin);
router.post('/admin/bank', webAuthenticateToken, adminController.addBank);
router.post('/admin/connect', webAuthenticateToken, adminController.connectExistingAccount);

module.exports = router;