const CryptoJS = require("crypto-js");
const moment = require("moment");
const path = require("path");

const config = {
  app_id: "2553",
  key1: "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL",
  key2: "kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz",
  endpoint: "https://sb-openapi.zalopay.vn/v2/create",
  query_endpoint: "https://sb-openapi.zalopay.vn/v2/query",
};

const generateTransactionId = () => {
  return Math.floor(Math.random() * 1000000);
};

const createAppTransId = (transID) => {
  return `${moment().format("YYMMDD")}_${transID}`;
};

const generateMac = (data, key) => {
  return CryptoJS.HmacSHA256(data, key).toString();
};

const createOrderData = (orderData, orderId, transID) => {
  const amount = Number(orderData.totalAmount || orderData.amount);
  
  const items = [
    {
      productId: orderData.productId,
      name: orderData.productName || "Product",
      price: amount,
      quantity: orderData.quantity || 1,
    },
  ];

  const embed_data = {
    preferred_payment_method: ["vietqr"],
    redirecturl: path.resolve(__dirname, '../../../../frontend/pages/payment_success.html'),
    orderId: orderId,
  };

  const zaloOrder = {
    app_id: config.app_id,
    app_trans_id: createAppTransId(transID),
    app_user: orderData.buyerId || "guest",
    app_time: Date.now(),
    item: JSON.stringify(items),
    embed_data: JSON.stringify(embed_data),
    amount,
    description: `Thanh toán đơn hàng ${orderId}`,
    bank_code: "",
  };

  const data =
    config.app_id +
    "|" +
    zaloOrder.app_trans_id +
    "|" +
    zaloOrder.app_user +
    "|" +
    zaloOrder.amount +
    "|" +
    zaloOrder.app_time +
    "|" +
    zaloOrder.embed_data +
    "|" +
    zaloOrder.item;

  zaloOrder.mac = generateMac(data, config.key1);
  
  return zaloOrder;
};

const validateMac = (dataStr, mac) => {
  const macCheck = generateMac(dataStr, config.key2);
  return macCheck === mac;
};

const createQueryData = (app_trans_id) => {
  const postData = {
    app_id: config.app_id,
    app_trans_id,
  };

  const data = `${postData.app_id}|${postData.app_trans_id}|${config.key1}`;
  postData.mac = generateMac(data, config.key1);
  
  return postData;
};

module.exports = {
  config,
  generateTransactionId,
  createAppTransId,
  generateMac,
  createOrderData,
  validateMac,
  createQueryData,
};