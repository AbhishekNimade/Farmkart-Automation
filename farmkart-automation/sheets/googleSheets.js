// =====================================================
// File Name : googleSheet.js
// Purpose   : Google Sheets read/write utilities
// =====================================================

import { google } from "googleapis";

// ================= AUTH =================
const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// ================= CONFIG =================
const SPREADSHEET_ID = "1EyEZxOEnpPVbKhJx1fP1AkksVq6OXSGG4hfVOHjbuNs";
const SHEET_NAME = "01 April 2026";

// ================= READ ORDERS =================
export async function getOrders() {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!D2:H`,
    });

    const rows = res.data.values || [];

    return rows.map((row, index) => ({
        sheetRow: index + 2,
        orderId: (row[0] || "").toString().trim(),     // Column D
        awb: (row[1] || "").toString().trim(),         // Column E
        partner: (row[2] || "").toString().trim(),     // Column F
        orderStatus: (row[4] || "").toString().trim(), // Column H (Logistic Status)
        ofdStatus: (row[4] || "").toString().trim(),   // Column H (Logistic Status)
    }));
}

// ================= UPDATE REMARK =================
export async function updateSheetRemark(sheetRow, remark) {
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${SHEET_NAME}'!H${sheetRow}`,
        valueInputOption: "RAW",
        requestBody: {
            values: [[remark]],
        },
    });
}
