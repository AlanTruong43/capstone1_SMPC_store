const express = require("express");
const zaloPayController = require("./zalopay.controller");

const router = express.Router();

router.post("/create-order", zaloPayController.createOrder);
router.post("/callback", zaloPayController.handleCallback);
router.post("/query-order", zaloPayController.queryOrder);

module.exports = router;