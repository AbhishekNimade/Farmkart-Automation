import { google } from 'googleapis';
import path from 'path';

const SERVICE_ACCOUNT_FILE = path.join(
    import.meta.dirname,
    '../order-booking-automation/config/google-service-account.json'
);

const SPREADSHEET_ID = '1P2Q9Y1r104a4pALzcjC07uLEFHTinV9udh5xGw5A5Lg';
const SHEET_NAME = 'Sheet1';

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Fetch Order ID from Col C for a given row number.
 * Also checks Col B must be blank (not yet processed).
 */
export async function fetchOrderIdFromRow(rowNo) {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!B${rowNo}:C${rowNo}`,
        });

        const row = response.data.values ? response.data.values[0] : [];
        const colB = row && row[0] ? row[0].trim() : '';
        const colC = row && row[1] ? row[1].trim() : '';

        if (colB !== '') {
            console.log(`⚠️ Row ${rowNo}: Col B already filled ("${colB}"). Already processed — skipping.`);
            return null;
        }
        if (!colC || !/^\d{5,}$/.test(colC)) {
            console.log(`⚠️ Row ${rowNo}: Col C is empty or not a valid Order ID ("${colC}"). Skipping.`);
            return null;
        }

        return colC;
    } catch (error) {
        console.error(`❌ Error reading row ${rowNo}:`, error.message);
        throw error;
    }
}

/**
 * Find the next row AFTER the last non-empty entry in Col C.
 * Scans from bottom up — robust even with 1300+ rows.
 */
export async function getNextEmptyRow() {
    try {
        console.log('📡 Scanning Col C for last entry...');
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            // Fetch only Col C — large range to cover all data
            range: `${SHEET_NAME}!C:C`,
        });

        const rows = response.data.values || [];
        // rows[0] = row 1 (header), rows[1] = row 2 ...
        // Find the LAST non-empty cell in Col C
        let lastFilledIdx = 0; // 0-indexed into the rows array
        for (let i = 0; i < rows.length; i++) {
            const val = rows[i] && rows[i][0] ? rows[i][0].trim() : '';
            if (val !== '') {
                lastFilledIdx = i;
            }
        }

        // lastFilledIdx is 0-indexed; sheet row = lastFilledIdx + 1
        const lastFilledRow = lastFilledIdx + 1;
        const nextRow = lastFilledRow + 1;

        console.log(`📋 Last entry in Col C: Row ${lastFilledRow} — New entry will go to Row ${nextRow}`);
        return nextRow;

    } catch (error) {
        console.error('❌ Error scanning Col C:', error.message);
        throw error;
    }
}

/**
 * Write all post-cancel data to the sheet.
 * - Col B: Order Date (DD/MM/YYYY)
 * - Col C: Order ID (only if writing a new direct-order-id row)
 * - Col F: "Cancelled"
 * - Col G: "Other State" (default)
 */
export async function updateCancelStatus(rowNo, orderDate, orderId = null, returnFrom = 'Other State') {
    try {
        console.log(`\n📡 Writing to Google Sheet, Row ${rowNo}...`);
        console.log(`   B${rowNo} = "${orderDate}"`);
        if (orderId) console.log(`   C${rowNo} = "${orderId}"`);
        console.log(`   F${rowNo} = "Cancelled"`);
        console.log(`   G${rowNo} = "${returnFrom}"`);

        const updates = [];

        // Col B — Order Date
        if (orderDate) {
            updates.push({
                range: `${SHEET_NAME}!B${rowNo}`,
                values: [[orderDate]],
            });
        }

        // Col C — Order ID (only for direct order ID mode)
        if (orderId) {
            updates.push({
                range: `${SHEET_NAME}!C${rowNo}`,
                values: [[orderId]],
            });
        }

        // Col F — Cancelled
        updates.push({
            range: `${SHEET_NAME}!F${rowNo}`,
            values: [['Cancelled']],
        });

        // Col G — Return From
        updates.push({
            range: `${SHEET_NAME}!G${rowNo}`,
            values: [[returnFrom]],
        });

        if (updates.length === 0) {
            console.log('⚠️ Nothing to write — all values empty.');
            return;
        }

        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                valueInputOption: 'USER_ENTERED',
                data: updates,
            },
        });

        console.log(`✅ Sheet Row ${rowNo} updated successfully!`);
    } catch (error) {
        console.error(`❌ Sheet update FAILED for Row ${rowNo}:`, error.message);
        // Re-throw so caller knows update failed
        throw error;
    }
}
