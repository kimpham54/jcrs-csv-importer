// db/selftest.ts
import "dotenv/config";
import db, { TABLE } from "./knex.js";

(async () => {
  try {

    console.log(`📝 Inserting into ${TABLE}…`);
    const [id] = await db(TABLE).insert({
      handle: "hdl:test/123",
      pid: "PID-001",
      call_number: "CN-123",
      last_name: "Doe",
      first_name: "John",
      sex: "M",
      age: "42",
      notes: "Inserted via selftest script",
    });

    console.log("✅ Inserted record with ID:", id);

    const row = await db(TABLE).where({ id }).first();
    console.log("📄 Retrieved row:", row);
  } catch (err: any) {
    console.error("❌ Self-test failed:", err?.message || err);
  } finally {
    await db.destroy();
  }
})();