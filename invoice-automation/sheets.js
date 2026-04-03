import { google } from 'googleapis';
import path from 'path';

// Use the shared Service Account using dynamic directory mapping to survive Web Dashboard execution contexts
const SERVICE_ACCOUNT_FILE = path.join(import.meta.dirname, '../order-booking-automation/config/google-service-account.json');

const SPREADSHEET_ID = '1QTI__gAR-JVIHQtZRmL1LH_OmHHBDwfRB3aN4V7XCE4'; // Delivery_Tracker

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Fetch data specifically from "Delivery_Tracker" tab
 * We want records where Col B is Empty and Col C (Order ID) is purely numbers.
 */
export async function fetchFilterAndExportDeliveries() {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Delivery_Tracker!A:C',
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found in Delivery_Tracker sheet.');
            return [];
        }

        const validOrders = [];

        // Start from row 2 (index 1) assuming row 1 has headers
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const colB = row[1] ? row[1].trim() : '';
            const colC = row[2] ? row[2].trim() : '';

            // Condition 1: Col B must be empty (ignore "AI" and "Yes")
            if (colB !== '') {
                continue; // Skip already invoiced / processed items
            }

            // Condition 2: Col C must be a pure number
            if (/^\d+$/.test(colC)) {
                validOrders.push({
                    sheetRow: i + 1, // Store the exact row number for later updates
                    orderId: colC
                });
            }
        }

        return validOrders;

    } catch (error) {
        console.error('The API returned an error:', error);
        throw error;
    }
}

/**
 * Update Col B for a specific row to "AI"
 * @param {number} sheetRow - The absolute row number in the sheet
 */
export async function updateInvoiceStatus(sheetRow) {
    try {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Delivery_Tracker!B${sheetRow}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [['AI']],
            },
        });
        console.log(`✅ Sheet updated for Row ${sheetRow}: Col B set to "AI".`);
    } catch (error) {
        console.error(`❌ Error updating Sheet for Row ${sheetRow}:`, error.message);
    }
}

/**
 * Fallback backward compatibility export if ever needed
 */
export async function fetchDeliveredOrders() {
    return [];
}
