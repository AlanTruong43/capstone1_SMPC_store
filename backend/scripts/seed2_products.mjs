import admin from "firebase-admin";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Lấy đường dẫn tuyệt đối của file hiện tại (seed2_products.mjs)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đọc file serviceAccountKey.json trong backend/
const serviceAccount = JSON.parse(
  readFileSync(path.join(__dirname, "../serviceAccountKey.json"), "utf8")
);

// 3. Init Firebase
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
const db = admin.firestore();

// UID seller thật (tài khoản bạn đã đăng ký)
const SELLER_UID = "kdcwdK0dfvazAlSRE9GJIrSocDt2";

// Categories từ images
const categories = [
  { name: "Books", description: "Sách, tạp chí", slug: "books" },
  { name: "Clothes", description: "Thời trang", slug: "clothes" },
  { name: "Instruments", description: "Nhạc cụ", slug: "instruments" }
];

// Products mẫu (3 sản phẩm mỗi category)
const productsData = {
  Books: [
    {
      name: "milk and honey",
      description: "Tiểu thuyết kinh điển của rupi kaur, bản tiếng Anh",
      price: 250000,
      condition: "used",
      location: "HCMC",
      imageUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    },
    {
      name: "Thinking, fast and slow",
      description: "Sách của Daniel Kahneman, bản tiếng Anh",
      price: 85000,
      condition: "new",
      location: "Hanoi",
      imageUrl: "https://images.unsplash.com/photo-1593340010859-83edd3d6d13f?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1752",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    },
    {
      name: "How innovation works",
      description: "Sách của Matt Ridley, bản tiếng Anh",
      price: 120000,
      condition: "used",
      location: "Danang",
      imageUrl: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1812",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    }
  ],
  Clothes: [
    {
      name: "Áo sơ mi nam Uniqlo",
      description: "Áo sơ mi xanh size M, chất liệu cotton 100%",
      price: 450000,
      condition: "new",
      location: "HCMC",
      imageUrl: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=688",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    },
    {
      name: "Quần jean nữ H&M",
      description: "Quần jean skinny size 28, màu xanh đậm, đã giặt",
      price: 380000,
      condition: "used",
      location: "Hanoi",
      imageUrl: "https://media.istockphoto.com/id/695708092/photo/one-short-blue-jeans-isolated-on-white.webp?a=1&b=1&s=612x612&w=0&k=20&c=FduTyaKpSD6tK90V0jCH9-9KFGb3Csy26U9pJjL7HEw=",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    },
    {
      name: "Áo khoác hoodie Nike",
      description: "Áo khoác hoodie màu đen size L, logo Nike thêu",
      price: 650000,
      condition: "used",
      location: "Danang",
      imageUrl: "https://plus.unsplash.com/premium_photo-1673356301340-4522591be5f7?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTd8fG5pa2UlMjBob29kaWV8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&q=60&w=800",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    }
  ],
  Instruments: [
    {
      name: "Guitar Acoustic Yamaha F310",
      description: "Guitar acoustic classic, đàn cũ nhưng âm thanh vẫn hay",
      price: 2800000,
      condition: "used",
      location: "HCMC",
      imageUrl: "https://plus.unsplash.com/premium_photo-1664194584355-25196f114804?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    },
    {
      name: "Piano điện Casio PX-160",
      description: "Piano điện 88 phím, hàng mới 100%, có kèm ghế",
      price: 8500000,
      condition: "new",
      location: "Hanoi",
      imageUrl: "https://plus.unsplash.com/premium_photo-1682940442090-1fb10139a9f8?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1740",
      quantity: 1,
      status: "available",
      postDate: admin.firestore.FieldValue.serverTimestamp()
    },
    {
      name: "Trống cajon gỗ",
      description: "Trống cajon handmade từ gỗ thông, âm thanh ấm",
      price: 1200000,
      condition: "new",
      location: "Danang",
      imageUrl: "https://images.unsplash.com/photo-1703350019326-465a6f9d044e?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1742",
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
