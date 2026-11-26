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

async function testColumnN() {
    try {
        const rowNo = 1605; // Testing on row 1605
        const cancelDate = "25-Jul-2026"; // Sample date

        console.log(`📡 Writing test date to Google Sheet, Row ${rowNo}, Column N...`);

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!N${rowNo}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[cancelDate]],
            },
        });
        console.log(`✅ Sheet Row ${rowNo} Column N (Cancel Date) updated successfully with "${cancelDate}"!`);
    } catch (error) {
        console.error(`❌ Failed to update Column N:`, error.message);
    }
}

testColumnN();
