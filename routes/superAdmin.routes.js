const express = require("express");
const router = express.Router();
const superAdminController = require("../controllers/superAdminBcaas.controller");
const isSuperAdmin = require("../middleware/superAdminAuth.middleware");

// Protect all /superadmin/* endpoints with our role claim security interceptor
router.use("/superadmin", isSuperAdmin);

// Mount Phase 3 Client Management routes
router.post("/superadmin/bcaas/clients", superAdminController.createClient);
router.get("/superadmin/bcaas/clients", superAdminController.listClients);
router.patch("/superadmin/bcaas/clients/:id/deactivate", superAdminController.deactivateClient);

module.exports = router;