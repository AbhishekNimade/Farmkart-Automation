import { google } from "googleapis";
import path from "path";

const credentialsPath = path.resolve(process.cwd(), "..", "farmkart-automation", "credentials.json");
const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

async function verifyOrders() {
    console.log("Searching for 211449 and 211451 to see absolute row numbers...");
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: "1QTI__gAR-JVIHQtZRmL1LH_OmHHBDwfRB3aN4V7XCE4",
        range: "Delivery_Tracker!A6500:C6600",
    });
    
    res.data.values.forEach((r, i) => {
        if (r[2] === "211449" || r[2] === "211451") {
            console.log(`Row ${6500 + i}: ${r[2]}`);
        }
    });
}
verifyOrders();
