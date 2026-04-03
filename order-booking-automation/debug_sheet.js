import dotenv from "dotenv";
dotenv.config();

import { google } from "googleapis";
import path from "path";
import fs from "fs";

async function debugRow() {
    const KEY_FILE_PATH = path.join(process.cwd(), "config", "google-service-account.json");
    const auth = new google.auth.GoogleAuth({
        keyFile: KEY_FILE_PATH,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const SHEET_ID = process.env.SHEET_ID;

    const row = 4804;
    const range = `'01 April 2024'!B${row}:U${row}`; // Read Row 4804 Cols B to U

    console.log(`🔍 Inspecting Row ${row} in '01 April 2024' (Range: ${range})`);

    try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range });
        const values = res.data.values;
        if (values && values.length > 0) {
            const r = values[0];
            console.log("Raw Data:", JSON.stringify(r));
            console.log(`B (Order ID) [Idx 0]: ${r[0]}`);
            console.log(`C (AWB)      [Idx 1]: '${r[1]}' (Empty?: ${!r[1] || r[1].trim() === ""})`);
        } else {
            console.log("❌ No data found at that row.");
        }
    } catch (e) {
        console.log(`❌ Error: ${e.message}`);
    }
}

debugRow().catch(console.error);
