// CommonJS
const ALLOWED_CONDITIONS = ["new", "used"];
const ALLOWED_STATUS = ["available", "sold"];

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}
function isHttpUrl(v) {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

/**
 * Chấp nhận categorySlug (ưu tiên) hoặc categoryId (fallback).
 * Không nhận sellerId/postDate từ client (service sẽ gán).
 */
function validateAndNormalizeProduct(input = {}) {
  const errors = {};
  const out = {};

  // name
  if (!isNonEmptyString(input.name)) errors.name = "Tên sản phẩm là bắt buộc";
  else out.name = input.name.trim();

  // description
  if (!isNonEmptyString(input.description)) errors.description = "Mô tả là bắt buộc";
  else out.description = input.description.trim();

  // price
  const priceNum = Number(input.price);
  if (!Number.isFinite(priceNum) || priceNum <= 0) errors.price = "Giá phải là số > 0";
  else out.price = priceNum;

  // quantity
  const qtyNum = Number(input.quantity);
  if (!Number.isInteger(qtyNum) || qtyNum < 1) errors.quantity = "Số lượng phải là số nguyên >= 1";
  else out.quantity = qtyNum;

  // imageUrl
  if (!isHttpUrl(input.imageUrl)) errors.imageUrl = "imageUrl phải là URL http/https hợp lệ";
  else out.imageUrl = input.imageUrl.trim();

  // location
  if (!isNonEmptyString(input.location)) errors.location = "location là bắt buộc";
  else out.location = input.location.trim();

  // condition
  const cond = String(input.condition || "").trim().toLowerCase();
  if (!ALLOWED_CONDITIONS.includes(cond)) {
    errors.condition = `condition phải là: ${ALLOWED_CONDITIONS.join(", ")}`;
  } else out.condition = cond;

  // status (optional, default "available")
  if (input.status == null || String(input.status).trim() === "") {
    out.status = "available";
  } else {
    const st = String(input.status).trim().toLowerCase();
    if (!ALLOWED_STATUS.includes(st)) {
      errors.status = `status phải là: ${ALLOWED_STATUS.join(", ")}`;
    } else out.status = st;
  }

  // category: ưu tiên slug, fallback id
  if (isNonEmptyString(input.categorySlug)) {
    out.categorySlug = input.categorySlug.trim().toLowerCase();
  } else if (isNonEmptyString(input.categoryId)) {
    out.categoryId = input.categoryId.trim();
  } else {
    errors.category = "Cần truyền categorySlug (khuyến nghị) hoặc categoryId";
  }

  // KHÔNG nhận sellerId, postDate từ client

  if (Object.keys(errors).length) return { valid: false, errors };
  return { valid: true, data: out };
}

module.exports = { validateAndNormalizeProduct };
