import admin from "firebase-admin";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Lấy đường dẫn tuyệt đối của file hiện tại (seed_products.mjs)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đọc file serviceAccountKey.json trong backend/
const serviceAccount = JSON.parse(
  readFileSync(path.join(__dirname, "../serviceAccountKey.json"), "utf8")
);

// // 2. Firebase config lấy từ service account //không cần mục này nữa vì đang sử dụng admin sdk
// const firebaseConfig = {
//   apiKey: serviceAccount.apiKey,
//   authDomain: serviceAccount.authDomain,
//   projectId: serviceAccount.project_id,
// };

// 3. Init Firebase
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
const db = admin.firestore();

// UID seller thật (tài khoản bạn đã đăng ký)
const SELLER_UID = "dUjDNSVrvPYfgv5qsWPFx1sPMBM2";

// Categories mẫu
const categories = [
  { name: "Smartphones", description: "Các dòng điện thoại thông minh" },
  { name: "Laptops", description: "Máy tính xách tay cho công việc & học tập" },
  { name: "Accessories", description: "Phụ kiện công nghệ" }
];

// Products mẫu (3 sản phẩm mỗi category)
const productsData = {
  Smartphones: [
    {
      name: "iPhone X",
      description: "Chính hãng, còn bảo hành",
      price: 19990000,
      condition: "used",
      location: "HCMC",
      imageUrl: "https://unsplash.com/photos/silver-iphone-6-on-white-table-OxvlDO8RwKg",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    },
    {
      name: "Samsung Galaxy S21",
      description: "Fullbox, hàng mới 100%",
      price: 21000000,
      condition: "new",
      location: "Hanoi",
      imageUrl: "https://unsplash.com/photos/black-sony-remote-control-beside-white-tissue-paper-uCqMa_s-JDg",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    },
    {
      name: "Xiaomi Mi 11",
      description: "Xách tay, còn bảo hành 6 tháng",
      price: 12000000,
      condition: "used",
      location: "Danang",
      imageUrl: "https://unsplash.com/photos/a-hand-holding-a-black-cell-phone-TJaa6V70_kA",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    }
  ],
  Laptops: [
    {
      name: "MacBook Pro 14",
      description: "Chip M1 Pro, hàng like new",
      price: 38000000,
      condition: "used",
      location: "HCMC",
      imageUrl: "https://unsplash.com/photos/macbook-pro-turned-on-displaying-red-blue-and-yellow-lights-1sSfrozgiFk",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    },
    {
      name: "Dell XPS 13",
      description: "Hàng chính hãng, mới nguyên seal",
      price: 33000000,
      condition: "new",
      location: "Hanoi",
      imageUrl: "https://unsplash.com/photos/silver-laptop-on-brown-wooden-table-uWFFw7leQNI",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    },
    {
      name: "Asus ROG Zephyrus",
      description: "Gaming laptop, bảo hành 1 năm",
      price: 45000000,
      condition: "new",
      location: "Danang",
      imageUrl: "https://unsplash.com/photos/a-close-up-of-a-person-on-a-laptop-tkSqiW0qFJU",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    }
  ],
  Accessories: [
    {
      name: "AirPods Pro",
      description: "Tai nghe không dây, chính hãng Apple",
      price: 6000000,
      condition: "new",
      location: "HCMC",
      imageUrl: "https://unsplash.com/photos/white-apple-earpods-in-black-case-qQu4gTORkys",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    },
    {
      name: "Logitech MX Master 3",
      description: "Chuột không dây cao cấp cho dân văn phòng",
      price: 2500000,
      condition: "new",
      location: "Hanoi",
      imageUrl: "https://unsplash.com/photos/a-computer-mouse-sitting-on-top-of-a-blue-and-red-wall-tfDEY43gTgw",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    },
    {
      name: "Razer BlackWidow",
      description: "Bàn phím cơ gaming, switch xanh",
      price: 3200000,
      condition: "used",
      location: "Danang",
      imageUrl: "https://unsplash.com/photos/a-black-gaming-mouse-with-glowing-blue-accents-OCt51VyfYAs",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    }
  ]
};

async function seed() {
  try {
    // 1. Tạo categories
    for (const cat of categories) {
      const catRef = await db.collection("categories").add(cat);
      console.log(`✅ Category added: ${cat.name} (${catRef.id})`);

      // 2) Mỗi category: thêm 3 products
      const list = productsData[cat.name] || [];
      for (const p of list) {
        await db.collection("products").add({
          ...p,
          categoryId: catRef.id,
          sellerId: SELLER_UID,
          quantity: 1,
          status: "available",
          postDate: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      console.log(`   → 3 products for ${cat.name} added!`);
    }

    console.log("🎉 Done seeding sample data!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding data:", err);
    process.exit(1);
  }
}

seed();
