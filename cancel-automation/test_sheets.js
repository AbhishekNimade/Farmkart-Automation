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

async function testSheet(spreadsheetId) {
    try {
        console.log(`\nTesting Spreadsheet ID: ${spreadsheetId}`);
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        console.log("Title:", meta.data.properties.title);
        console.log("Sheets in document:");
        meta.data.sheets.forEach(s => {
            console.log(` - ${s.properties.title}`);
        });
    } catch (e) {
        console.error(`❌ Error fetching metadata for ${spreadsheetId}:`, e.message);
    }
}

(async () => {
    await testSheet('1P2Q9Y1r104a4pALzcjC07uLEFHTinV9udh5xGw5A5Lg');
    await testSheet('1EyEZxOEnpPVbKhJx1fP1AkksVq6OXSGG4hfVOHjbuNs');
})();
