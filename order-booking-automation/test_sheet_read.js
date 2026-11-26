
import dotenv from "dotenv";
dotenv.config();
import { readPendingOrders } from "./config/sheet.js";

async function test() {
    const startRow = 589; // Example row
    console.log(`Reading orders from row ${startRow}...`);
    try {
        const orders = await readPendingOrders(startRow);
        console.log(`Found ${orders.length} orders.`);
        if (orders.length > 0) {
            console.log("First order ID:", orders[0].orderId);
            console.log("Raw Row data:", JSON.stringify(orders[0].rawRow, null, 2));
            console.log("Customer Details:", JSON.stringify(orders[0].customerDetails, null, 2));
        }
    } catch (err) {
        console.error("Error reading orders:", err);
    }
}

test();
