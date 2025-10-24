const axios = require("axios");
const qs = require("qs");
const { db } = require("../../config/firebase");
const { config, generateTransactionId, createOrderData, validateMac, createQueryData } = require("./zalopay.utils");

class ZaloPayService {
  async createOrder(orderId) {
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      throw new Error("Order not found");
    }

    const orderData = orderSnap.data();
    const transID = generateTransactionId();
    const zaloOrder = createOrderData(orderData, orderId, transID);

    const result = await axios.post(config.endpoint, qs.stringify(zaloOrder), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    await orderRef.update({
      paymentProvider: "ZALOPAY",
      zaloPayTransId: zaloOrder.app_trans_id,
      zaloPayToken: result.data.zp_trans_token || null,
      zaloPayQrCode: result.data.qr_code || null,
      paymentStatus: "pending",
      updatedAt: new Date(),
    });

    return result.data;
  }

  async handleCallback(dataStr, mac) {
    if (!validateMac(dataStr, mac)) {
      throw new Error("Invalid MAC");
    }

    const dataJson = JSON.parse(dataStr);
    const embedData = JSON.parse(dataJson.embed_data || "{}");
    const orderId = embedData.orderId;

    if (!orderId) {
      throw new Error("Missing orderId in embed_data");
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      throw new Error("Order not found");
    }

    await orderRef.update({
      paymentStatus: dataJson.return_code === 1 ? "paid" : "failed",
      zaloPayReturnCode: dataJson.return_code,
      zaloPayReturnMessage: dataJson.return_message,
      zaloPayCallbackData: dataJson,
      updatedAt: new Date(),
    });

    return {
      orderId,
      status: dataJson.return_code === 1 ? "paid" : "failed"
    };
  }

  async queryOrder(app_trans_id) {
    const postData = createQueryData(app_trans_id);

    const result = await axios.post(config.query_endpoint, qs.stringify(postData), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    return result.data;
  }
}

module.exports = new ZaloPayService();