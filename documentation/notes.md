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

## 8. Commissions Collection (`commissions`) // optional ?
- **Fields**:
  - `transactionId` (string → `transactions/{id}`)
  - `sellerId` (string → `users/{uid}`)
  - `policyId` (string → `commission_policies/{id}`)
  - `commissionAmount` (number)
  - `calculationDate` (timestamp)
  - `status` (string: `"pending" | "paid"`)

---

## 9. Chat Logs Collection (`chat_logs`)   //optional ?
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

10/10 :
- Sửa link chi tiết sản phẩm ở `frontend/js/product_list.js` từ `product_detail.html` → `product_details.html`.
- Thêm các ID hook vào `frontend/pages/product_details.html` để map dữ liệu động (không đổi CSS):
  - Breadcrumb: `breadcrumbCategory`, `breadcrumbProduct`, `detailCategory`, `detailSubCategory`.
  - Thông tin chính: `productTitle`, `mainImage` (giữ nguyên), `productCondition`, `productLocation`, `productShipping` (ẩn), `productPrice`, `productOldPrice` (ẩn), `productSave` (ẩn), `sellerName`, `productDescription`.
  - Liên quan: `relatedProducts` (container render danh sách).
- Cập nhật `frontend/js/product_detail.js` để:
  - Đọc `id` từ query string và gọi `GET /products/:id`.
  - Map field: `name`, `imageUrl` (onerror hiển thị "This image is not available now"), `price` (format VND), `condition` (map `new`→"New", `used`→"Used"), `location`, `description`, breadcrumb theo `category.name`.
  - Thử gọi `GET /users/:id` theo `sellerId` để lấy `displayName/email`; nếu không có endpoint/không tìm thấy thì fallback hiển thị `sellerId` và `console.log` theo yêu cầu.
  - Gọi `GET /products` để lọc và render tối đa 4 sản phẩm liên quan cùng `categoryId` (loại bỏ sản phẩm hiện tại); xử lý lỗi ảnh cho từng item liên quan.
  - Ẩn các trường chưa có dữ liệu trong DB: old price/discount/shipping.
  - Xử lý lỗi: thiếu `id`/không fetch được → đặt tiêu đề thân thiện và ghi log; không thay đổi backend error handler.
- Backend: thêm endpoint `GET /users/:id` tại `backend/src/modules/users/users_routes.js` trả về tối thiểu `{ id, displayName, email, role }` từ collection `users`; mount tại `/users` trong `backend/src/index.js`.
- Không thay đổi CSS.

- Tình trạng hiển thị hiện tại:
  - Trang danh sách và trang chi tiết đã hiển thị được sản phẩm bình thường từ Firestore thông qua các endpoint `/products` và `/products/:id`.
  - Breadcrumb, giá (format VND), condition, location, description đã map đúng; ảnh có xử lý lỗi (fallback thông báo khi ảnh hỏng).

- Các chỉnh sửa chính đã thực hiện để khắc phục tình trạng trước đó:
  - Sửa đường dẫn trang chi tiết trong danh sách sản phẩm cho đúng tên file.
  - Bổ sung các ID hook vào HTML để gán dữ liệu động mà không thay đổi CSS.
  - Cập nhật script trang chi tiết để đọc `id` từ URL, gọi API chi tiết sản phẩm, map dữ liệu và render sản phẩm liên quan.
  - Thêm endpoint `/users/:id` để lấy thông tin người bán cơ bản (nếu có), có fallback khi không tồn tại.

- Vấn đề còn tồn tại:
  - CSS: một số phần căn lề/khoảng cách/icon giữa trang danh sách và trang chi tiết chưa đồng nhất; cần tinh chỉnh CSS sau (chưa thay đổi trong lần này).
  - Hardcode: một vài phần trên trang chi tiết vẫn mang tính tĩnh/chưa có dữ liệu từ DB (ví dụ: old price/discount/shipping đang ẩn hoặc placeholder; avatar người bán; bộ ảnh thumbnail tĩnh chưa gắn gallery theo sản phẩm).
  - i18n: nhãn condition đang hiển thị "New/Used" cần Việt hóa đồng nhất toàn site nếu muốn.
  - Breadcrumb chưa hỗ trợ đa cấp khi danh mục có nhiều tầng (hiện hiển thị 1 cấp dựa trên category hiện tại).

Hướng dẫn test thủ công:
1) Khởi chạy backend:
   - `cd capstone1_SMPC_store/backend`
   - `npm install` (lần đầu)
   - `npm start` (hoặc `node src/index.js`)
2) Mở trang danh sách: `http://localhost:4000/pages/product_list.html`.
   - Kiểm tra các thẻ sản phẩm hiển thị, bấm "View Details" → điều hướng tới `product_details.html?id=<productId>`.
3) Trên trang chi tiết:
   - Kiểm tra Title, Breadcrumb, Price (định dạng VND), Condition (New/Used), Location, Description.
   - Kiểm tra ảnh: nếu ảnh lỗi → hiển thị dòng "This image is not available now".
   - Kiểm tra Seller: nếu có `users/{sellerId}` với `displayName` → hiển thị tên; nếu không → hiển thị `sellerId` và xem `console.log` thông báo endpoint không sẵn sàng/không tìm thấy.
   - Kiểm tra sản phẩm liên quan: hiển thị tối đa 4 sản phẩm cùng `categoryId`, không bao gồm sản phẩm hiện tại.
4) Kiểm thử lỗi:
   - Truy cập `product_details.html` KHÔNG có `?id=` → tiêu đề hiển thị thông báo thiếu ID.
   - Truy cập với `?id` không tồn tại → tiêu đề hiển thị lỗi tải sản phẩm, xem `console.log`.

   16/10 : cài đặt thêm thư viện : npm i @payos/node để sử dụng payos