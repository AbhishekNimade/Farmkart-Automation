// =====================================================
// File Name : sheet.js
// Project   : Order Booking Automation (Farmkart)
// Author    : Abhishek Nimade
// Purpose   : Google Sheets read/write utility
//            - Read orders where Order ID exists
//            - Book order ONLY if AWB No is blank
// =====================================================

import { google } from "googleapis";
import path from "path";
import fs from "fs";

// -----------------------------
// Load Google Service Account
// -----------------------------
const KEY_FILE_PATH = path.join(
    process.cwd(),
    "config",
    "google-service-account.json"
);

if (!fs.existsSync(KEY_FILE_PATH)) {
    throw new Error("❌ google-service-account.json not found in config folder");
}

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// -----------------------------
// Read Pending Orders
// -----------------------------
/**
 * Reads orders from Google Sheet (Strict Mapping)
 * Range: B:U
 * 
 * Column Mapping (Relative to B=0):
 * B (0)  : Order ID
 * C (1)  : AWB No (Check if empty)
 * D (2)  : Partner (Dropdown)
 * ...
 * H (6)  : Customer Name
 * I (7)  : Contact Number
 * J (8)  : Pincode
 * K (9)  : Address (Part 1)
 * L (10) : Village
 * M (11) : Tehsil
 * N (12) : District
 * O (13) : State
 * ...
 * R (16) : COD Amount (Collectable Amount)
 * T (18) : Weight (Write back)
 * U (19) : Delivery Charges (Write back)
 *
 * @param {number} startRow - Starting row number
 * @returns {Array} List of pending orders with full customer details
 */
export async function readPendingOrders(startRow) {
    const SHEET_ID = process.env.SHEET_ID;

    if (!SHEET_ID) {
        throw new Error("❌ SHEET_ID missing in .env");
    }

    // Read form Column D to Z
    const range = `'01 April 2026'!D${startRow}:Z`; // Expanded from U to Z to be safe

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range,
    });

    const rows = response.data.values || [];
    const orders = [];

    rows.forEach((row, index) => {
        const actualRowNumber = startRow + index;

        // Indices relative to D (which is index 0 in this range)
        const orderId = row[0];       // Col D
        const awbStatus = row[1];     // Col E

        // Basic check: Order ID should be numeric/valid length
        if (orderId && orderId.length > 4) {
            // ONLY process if AWB (Col E) is EMPTY
            if (!awbStatus || awbStatus.trim() === "") {
                orders.push({
                    rowNumber: actualRowNumber,
                    orderId: orderId.toString().trim(),
                    // Capture other columns strictly as strings (or empty)
                    customerDetails: {
                        name: row[8],      // L
                        phone: row[9],     // M
                        pincode: row[10],  // N
                        addressPart: row[11], // O
                        village: row[12],  // P
                        tehsil: row[13],   // Q
                        district: row[14], // R
                        state: row[15],    // S (Assuming next available or based on pattern)
                        boxSize: row[3],   // G
                        codAmount: row[18], // V (COD Amount)
                    },
                    rawRow: row,
                });
            }
        }
    });

    return orders;
}

// -----------------------------
// Update AWB Number
// -----------------------------
/**
 * Updates AWB number in Column E
 *
 * @param {number} rowNumber - Sheet row number
 * @param {string} awbNumber - Generated AWB
 */
export async function updateAwb(rowNumber, awbNumber) {
    const SHEET_ID = process.env.SHEET_ID;

    if (!SHEET_ID) {
        throw new Error("❌ SHEET_ID missing in .env");
    }

    // Write to Column E
    const range = `'01 April 2026'!E${rowNumber}`;

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range,
            valueInputOption: "RAW",
            requestBody: {
                values: [[awbNumber]],
            },
        });
    } catch (e) {
        if (e.message.includes("protected")) {
            console.error(`   ⚠️ Sheet Error: Column E is protected. Could not write AWB: ${awbNumber}`);
        } else {
            throw e;
        }
    }
}

// -----------------------------
// Update Delivery Partner
// -----------------------------
/**
 * Updates Delivery Partner in Column F
 * 
 * @param {number} rowNumber 
 * @param {string} partner 
 */
export async function updateDeliveryPartner(rowNumber, partner = "Delhivery") {
    const SHEET_ID = process.env.SHEET_ID;
    const range = `'01 April 2026'!F${rowNumber}`;

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range,
            valueInputOption: "RAW",
            requestBody: {
                values: [[partner]],
            },
        });
        console.log(`   📝 Updated Delivery Partner (Col F) for Row ${rowNumber}: ${partner}`);
    } catch (e) {
        console.error(`   ⚠️ Sheet Error: Could not update partner in Col F: ${e.message}`);
    }
}

// -----------------------------
// Update Booking Status
// -----------------------------
/**
 * Updates Booking Status in Column H
 *
 * @param {number} rowNumber - Sheet row number
 * @param {string} status - Status text (e.g. "Booked by AI")
 */
export async function updateBookingStatus(rowNumber, status = "Booked by AI") {
    const SHEET_ID = process.env.SHEET_ID;

    if (!SHEET_ID) {
        throw new Error("❌ SHEET_ID missing in .env");
    }

    // Write to Column H
    const range = `'01 April 2026'!H${rowNumber}`;

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range,
            valueInputOption: "RAW",
            requestBody: {
                values: [[status]],
            },
        });
    } catch (e) {
        if (e.message.includes("protected")) {
            console.error(`   ⚠️ Sheet Error: Column H is protected. Could not write status: ${status}`);
        } else {
            throw e;
        }
    }

    console.log(`   📝 Updated Booking Status (Col H) for Row ${rowNumber}: ${status}`);
}

// -----------------------------
// Update Delivery Charge
// -----------------------------
/**
 * Updates Delivery Charge in Column Y
 *
 * @param {number} rowNumber - Sheet row number
 * @param {number} amount - Rounded delivery charge
 */
export async function updateDeliveryCharge(rowNumber, amount) {
    const SHEET_ID = process.env.SHEET_ID;

    if (!SHEET_ID) {
        throw new Error("❌ SHEET_ID missing in .env");
    }

    // Write to Column Y
    const range = `'01 April 2026'!Y${rowNumber}`;

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range,
            valueInputOption: "RAW",
            requestBody: {
                values: [[amount]],
            },
        });
    } catch (e) {
        if (e.message.indexOf("protected") !== -1) {
            console.error(`   ⚠️ Sheet Error: Column Y is protected. Could not write charge: ${amount}`);
        } else {
            throw e;
        }
    }

    console.log(`   📝 Updated Delivery Charge (Col Y) for Row ${rowNumber}: ₹${amount} [SUCCESS]`);
}

// -----------------------------
// Update Order Weight
// -----------------------------
/**
 * Updates Order Weight in Column X
 *
 * @param {number} rowNumber - Sheet row number
 * @param {number} weightKg - Weight in KG
 */
export async function updateOrderWeight(rowNumber, weightKg) {
    const SHEET_ID = process.env.SHEET_ID;

    if (!SHEET_ID) {
        throw new Error("❌ SHEET_ID missing in .env");
    }

    // Write to Column X
    const range = `'01 April 2026'!X${rowNumber}`;

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range,
            valueInputOption: "RAW",
            requestBody: {
                values: [[weightKg]],
            },
        });
    } catch (e) {
        if (e.message.indexOf("protected") !== -1) {
            console.error(`   ⚠️ Sheet Error: Column X is protected. Could not write weight: ${weightKg}`);
        } else {
            throw e;
        }
    }

    console.log(`   📝 Updated Order Weight (Col X) for Row ${rowNumber}: ${weightKg} kg`);
}

// -----------------------------
// Update Booking Date
// -----------------------------
/**
 * Updates Booking Date in Column J
 *
 * @param {number} rowNumber - Sheet row number
 * @param {string} dateStr - Date string (e.g. "14 Jan 2026, 09:54 am")
 */
export async function updateBookingDate(rowNumber, dateStr) {
    const SHEET_ID = process.env.SHEET_ID;

    if (!SHEET_ID) {
        throw new Error("❌ SHEET_ID missing in .env");
    }

    // Write to Column J
    const range = `'01 April 2026'!J${rowNumber}`;

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range,
            valueInputOption: "RAW",
            requestBody: {
                values: [[dateStr]],
            },
        });
        console.log(`   📝 Updated Booking Date (Col J) for Row ${rowNumber}: ${dateStr}`);
    } catch (e) {
        if (e.message.includes("protected")) {
            console.error(`   ⚠️ Sheet Error: Column J is protected. Could not write booking date: ${dateStr}`);
        } else {
            throw e;
        }
    }
}
