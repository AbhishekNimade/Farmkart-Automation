import { google } from 'googleapis';
import path from 'path';

const SERVICE_ACCOUNT_FILE = path.join(
    import.meta.dirname,
    '../order-booking-automation/config/google-service-account.json'
);

const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const SPREADSHEET_ID = '1P2Q9Y1r104a4pALzcjC07uLEFHTinV9udh5xGw5A5Lg';
const SHEET_NAME = 'Sheet1';

async function readSheetData() {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A1:N10`,
        });
        console.log("Headers & Top Rows:");
        console.log(JSON.stringify(response.data.values, null, 2));
    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

readSheetData();
