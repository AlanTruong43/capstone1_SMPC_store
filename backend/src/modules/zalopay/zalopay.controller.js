const zaloPayService = require("./zalopay.service");

class ZaloPayController {
  async createOrder(req, res) {
    try {
      const { orderId } = req.body;
      
      if (!orderId) {
        return res.status(400).json({ error: "orderId is required" });
      }

      const result = await zaloPayService.createOrder(orderId);

      return res.status(200).json({
        message: "ZaloPay order created successfully",
        zaloPayResponse: result,
      });
    } catch (error) {
      console.error("[ZaloPay] Error:", error.response?.data || error);
      res.status(500).json({ message: "Something went wrong", error: error.message });
    }
  }

  async handleCallback(req, res) {
    try {
      const { data: dataStr, mac } = req.body;

      const result = await zaloPayService.handleCallback(dataStr, mac);
      
      console.log(`[ZaloPay] Order ${result.orderId} updated to ${result.status}`);

      return res.json({
        return_code: 1,
        return_message: "success",
      });
    } catch (error) {
      console.error("[ZaloPay Callback] Error:", error);
      
      if (error.message === "Invalid MAC") {
        return res.json({ return_code: -1, return_message: "mac not equal" });
      }
      
      if (error.message === "Missing orderId in embed_data") {
        return res.json({ return_code: -1, return_message: "missing orderId" });
      }
      
      if (error.message === "Order not found") {
        return res.json({ return_code: 0, return_message: "order not found" });
      }

      return res.json({
        return_code: 0,
        return_message: "error",
      });
    }
  }

  async queryOrder(req, res) {
    try {
      const { app_trans_id } = req.body;
      
      if (!app_trans_id) {
        return res.status(400).json({ error: "app_trans_id is required" });
      }

      const result = await zaloPayService.queryOrder(app_trans_id);

      return res.status(200).json({
        message: "Query successful",
        zaloPayResponse: result,
      });
    } catch (error) {
      console.error("[ZaloPay Query] Error:", error.response?.data || error);
      res.status(500).json({ message: "Query failed", error: error.message });
    }
  }
}

module.exports = new ZaloPayController();