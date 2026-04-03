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

    // Read form Column B to U
    const range = `'01 April 2024'!B${startRow}:Z`; // Expanded from U to Z to be safe

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range,
    });

    const rows = response.data.values || [];
    const orders = [];

    rows.forEach((row, index) => {
        const actualRowNumber = startRow + index;

        // Indices relative to B (which is index 0 in this range)
        const orderId = row[0];       // Col B
        const awbStatus = row[1];     // Col C

        // Basic check: Order ID should be numeric/valid length
        if (orderId && orderId.length > 4) {
            // ONLY process if AWB (Col C) is EMPTY
            if (!awbStatus || awbStatus.trim() === "") {
                orders.push({
                    rowNumber: actualRowNumber,
                    orderId: orderId.toString().trim(),
                    // Capture other columns strictly as strings (or empty)
                    customerDetails: {
                        name: row[8],      // J
                        phone: row[9],     // K
                        pincode: row[10],  // L
                        addressPart: row[11], // M
                        village: row[12],  // N
                        tehsil: row[13],   // O
                        district: row[14], // P
                        state: row[15],    // Q (Assuming next available or based on pattern)
                        boxSize: row[3],   // E
                        codAmount: row[18], // T (COD Amount)
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
 * Updates AWB number in Column C
 *
 * @param {number} rowNumber - Sheet row number
 * @param {string} awbNumber - Generated AWB
 */
export async function updateAwb(rowNumber, awbNumber) {
    const SHEET_ID = process.env.SHEET_ID;

    if (!SHEET_ID) {
        throw new Error("❌ SHEET_ID missing in .env");
    }

    // Write to Column C
    const range = `'01 April 2024'!C${rowNumber}`;

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
            console.error(`   ⚠️ Sheet Error: Column C is protected. Could not write AWB: ${awbNumber}`);
        } else {
            throw e;
        }
    }
}

// -----------------------------
// Update Delivery Partner
// -----------------------------
/**
 * Updates Delivery Partner in Column D
 * 
 * @param {number} rowNumber 
 * @param {string} partner 
 */
export async function updateDeliveryPartner(rowNumber, partner = "Delhivery") {
    const SHEET_ID = process.env.SHEET_ID;
    const range = `'01 April 2024'!D${rowNumber}`;

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range,
            valueInputOption: "RAW",
            requestBody: {
                values: [[partner]],
            },
        });
        console.log(`   📝 Updated Delivery Partner (Col D) for Row ${rowNumber}: ${partner}`);
    } catch (e) {
        console.error(`   ⚠️ Sheet Error: Could not update partner in Col D: ${e.message}`);
    }
}

// -----------------------------
// Update Booking Status
// -----------------------------
/**
 * Updates Booking Status in Column F
 *
 * @param {number} rowNumber - Sheet row number
 * @param {string} status - Status text (e.g. "Booked by AI")
 */
export async function updateBookingStatus(rowNumber, status = "Booked by AI") {
    const SHEET_ID = process.env.SHEET_ID;

    if (!SHEET_ID) {
        throw new Error("❌ SHEET_ID missing in .env");
    }

    // Write to Column F
    const range = `'01 April 2024'!F${rowNumber}`;

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
            console.error(`   ⚠️ Sheet Error: Column F is protected. Could not write status: ${status}`);
        } else {
            throw e;
        }
    }

    console.log(`   📝 Updated Booking Status (Col F) for Row ${rowNumber}: ${status}`);
}

// -----------------------------
// Update Delivery Charge
// -----------------------------
/**
 * Updates Delivery Charge in Column U (Index 21/U)
 *
 * @param {number} rowNumber - Sheet row number
 * @param {number} amount - Rounded delivery charge
 */
export async function updateDeliveryCharge(rowNumber, amount) {
    const SHEET_ID = process.env.SHEET_ID;

    if (!SHEET_ID) {
        throw new Error("❌ SHEET_ID missing in .env");
    }

    // Write to Column W (Shifted from U to W)
    const range = `'01 April 2024'!W${rowNumber}`;

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
            console.error(`   ⚠️ Sheet Error: Column W is protected. Could not write charge: ${amount}`);
        } else {
            throw e;
        }
    }

    console.log(`   📝 Updated Delivery Charge (Col W) for Row ${rowNumber}: ₹${amount} [SUCCESS]`);
}

// -----------------------------
// Update Order Weight
// -----------------------------
/**
 * Updates Order Weight in Column T (Index 20/T)
 *
 * @param {number} rowNumber - Sheet row number
 * @param {number} weightKg - Weight in KG
 */
export async function updateOrderWeight(rowNumber, weightKg) {
    const SHEET_ID = process.env.SHEET_ID;

    if (!SHEET_ID) {
        throw new Error("❌ SHEET_ID missing in .env");
    }

    // Write to Column V (Shifted from T to V)
    const range = `'01 April 2024'!V${rowNumber}`;

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
            console.error(`   ⚠️ Sheet Error: Column V is protected. Could not write weight: ${weightKg}`);
        } else {
            throw e;
        }
    }

    console.log(`   📝 Updated Order Weight (Col V) for Row ${rowNumber}: ${weightKg} kg`);
}

// -----------------------------
// Update Booking Date
// -----------------------------
/**
 * Updates Booking Date in Column H
 *
 * @param {number} rowNumber - Sheet row number
 * @param {string} dateStr - Date string (e.g. "14 Jan 2026, 09:54 am")
 */
export async function updateBookingDate(rowNumber, dateStr) {
    const SHEET_ID = process.env.SHEET_ID;

    if (!SHEET_ID) {
        throw new Error("❌ SHEET_ID missing in .env");
    }

    // Write to Column H
    const range = `'01 April 2024'!H${rowNumber}`;

    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range,
            valueInputOption: "RAW",
            requestBody: {
                values: [[dateStr]],
            },
        });
        console.log(`   📝 Updated Booking Date (Col H) for Row ${rowNumber}: ${dateStr}`);
    } catch (e) {
        if (e.message.includes("protected")) {
            console.error(`   ⚠️ Sheet Error: Column H is protected. Could not write booking date: ${dateStr}`);
        } else {
            throw e;
        }
    }
}
