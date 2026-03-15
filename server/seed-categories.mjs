import mysql from "mysql2/promise";

const categories = [
  { name: "消耗品", code: "supplies" },
  { name: "交通費", code: "transportation" },
  { name: "食事代", code: "meals" },
  { name: "通信費", code: "communication" },
  { name: "水道光熱費", code: "utilities" },
  { name: "賃料", code: "rent" },
  { name: "広告宣伝費", code: "advertising" },
  { name: "旅費", code: "travel" },
  { name: "接待交際費", code: "entertainment" },
  { name: "修繕費", code: "repairs" },
  { name: "保険料", code: "insurance" },
  { name: "税金", code: "taxes" },
  { name: "その他", code: "other" },
];

async function seed() {
  try {
    console.log("Seeding expense categories...");
    
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    for (const category of categories) {
      try {
        await connection.execute(
          "INSERT INTO expenseCategories (name, code) VALUES (?, ?)",
          [category.name, category.code]
        );
      } catch (error) {
        // Ignore duplicate key errors
        if (error.code !== "ER_DUP_ENTRY") {
          console.error(`Error inserting ${category.code}:`, error.message);
        }
      }
    }
    
    console.log("✓ Expense categories seeded successfully");
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error("Error seeding categories:", error);
    process.exit(1);
  }
}

seed();
