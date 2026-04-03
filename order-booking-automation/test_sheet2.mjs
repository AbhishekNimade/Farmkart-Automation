import { google } from "googleapis";
import path from "path";

const credentialsPath = path.resolve(process.cwd(), "config", "google-service-account.json");
const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

async function verifyOrders() {
    console.log("Fetching Row 6184 directly:");
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: "1QTI__gAR-JVIHQtZRmL1LH_OmHHBDwfRB3aN4V7XCE4",
        range: "Delivery_Tracker!B6184:C6186",
    });
    console.log(res.data.values);
}
verifyOrders();
