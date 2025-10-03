# Firestore Database Structure - SMPC Store

## 1. Users Collection (`users`)
- **Document ID**: `uid` (trùng với Firebase Auth UID)
- **Fields**:
  - `username` (string) – tên hiển thị
  - `email` (string) – email người dùng
  - `phone` (string, optional) – số điện thoại
  - `role` (string: `"buyer" | "seller" | "admin"`)
  - `address` (string, optional) – địa chỉ mặc định
  - `registrationDate` (timestamp) – ngày tạo
  - `lastLogin` (timestamp) – lần đăng nhập cuối
  - `isActive` (boolean) – tài khoản còn hoạt động không

---

## 2. Categories Collection (`categories`)
- **Fields**:
  - `name` (string) – tên danh mục
  - `description` (string, optional) – mô tả

---

## 3. Products Collection (`products`)
- **Fields**:
  - `name` (string) – tên sản phẩm
  - `description` (string)
  - `price` (number)
  - `categoryId` (reference/string → `categories/{id}`)
  - `sellerId` (string → `users/{uid}`)
  - `postDate` (timestamp)
  - `status` (string: `"available" | "sold"`)
  - `condition` (string: `"new" | "used"`)
  - `location` (string)
  - `viewCount` (number)
  - `isFeature` (boolean)

---

## 4. Orders Collection (`orders`)
- **Fields**:
  - `userId` (string → `users/{uid}`)
  - `orderDate` (timestamp)
  - `status` (string: `"pending" | "paid" | "shipped" | "completed"`)
  - `totalAmount` (number)
  - `shippingAddress` (string)
  - `notes` (string, optional)
  - `items` (array of objects):
    ```json
    [
      {
        "productId": "abc123",
        "quantity": 2,
        "unitPrice": 100.0
      }
    ]
    ```

---

## 5. Transactions Collection (`transactions`)
- **Fields**:
  - `orderId` (string → `orders/{id}`)
  - `payerId` (string → `users/{uid}`)
  - `payeeId` (string → `users/{uid}`)
  - `amount` (number)
  - `currency` (string, e.g. "VND")
  - `paymentMethod` (string: `"card" | "bank" | "cash"`)
  - `status` (string: `"pending" | "success" | "failed"`)
  - `txnDate` (timestamp)
  - `externalTransactionId` (string, optional)

---

## 6. Reviews Collection (`reviews`)
- **Fields**:
  - `productId` (string → `products/{id}`)
  - `reviewerId` (string → `users/{uid}`)
  - `rating` (number 1–5)
  - `comment` (string)
  - `reviewDate` (timestamp)

---

## 7. Commission Policies Collection (`commission_policies`)
- **Fields**:
  - `name` (string)
  - `rate` (number, e.g. 0.1 = 10%)
  - `feeType` (string: `"percent" | "fixed"`)
  - `startDate` (date)
  - `endDate` (date)
  - `description` (string)
  - `isActive` (boolean)

---

## 8. Commissions Collection (`commissions`)
- **Fields**:
  - `transactionId` (string → `transactions/{id}`)
  - `sellerId` (string → `users/{uid}`)
  - `policyId` (string → `commission_policies/{id}`)
  - `commissionAmount` (number)
  - `calculationDate` (timestamp)
  - `status` (string: `"pending" | "paid"`)

---

## 9. Chat Logs Collection (`chat_logs`)
- **Fields**:
  - `userId` (string → `users/{uid}`)
  - `message` (string)
  - `suggestedProductId` (string → `products/{id}`, optional)
  - `senderType` (string: `"user" | "system"`)
  - `timestamp` (timestamp)

---


## Notes
- **References** có thể lưu dưới dạng `string id` hoặc **Firestore reference**.  
- Thêm **indexes** khi query nhiều field (vd: `categoryId + status` trong products).  
- Có thể gom một số collection phụ thành **subcollection** nếu cần (vd: `order_items` trong mỗi order), nhưng với Firestore lưu dạng array cũng ổn.
- Kết hợp sử dụng database realtime cho notifications và những mục cần tức thì, đồng thời vẫn giữ nguyên cơ sở cứng bên Firestore database.
- Sửa lại cấu trúc, thêm notifications và presence bên realtime để phục vụ mục đích sau này

25/9 : 
Tạo file json chứa root key value cho realtime, và set rule cho nó
Không thể sử dụng firestore storage nên chuyển hướng dùng link cứng từ unsplash


1/10 :
cài thêm thư viện @faker-js/faker 
tạo thêm scripts sinh dữ liệu
chỉnh sửa lại collection 

2/10 :
chỉnh sửa document, thêm slug cho categories để query dễ hơn
test backend với module products

3//10 :
Sửa lại file product_list.html và js để liên kết với datbase, tạo thêm 1 route metadata để fetch dữ liệu từ firestore về, sửa lại url trong firestore, chỉnh cho các nút tìm, lọc theo category, condition, location giống với document, không bị hardcode