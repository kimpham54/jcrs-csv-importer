// db/knex.ts
import "dotenv/config";
import knex from "knex";

export const TABLE = process.env.DB_TABLE;

const db = knex({
  client: "mysql2",
  connection: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || "jcrs_records",
  },
});


export default db;