import { getInvoiceOrders } from './invoice-automation/sheets.js';
import dotenv from 'dotenv';
dotenv.config({ path: './order-booking-automation/.env' });

async function verifyOrders() {
    const orders = await getInvoiceOrders(6571);
    console.log("Filtered Orders from Row 6571:");
    console.log(orders.slice(0, 5)); 
}
verifyOrders();
