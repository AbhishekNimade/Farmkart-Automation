import { getInvoiceOrders } from './invoice-automation/sheets.js';
import dotenv from 'dotenv';
dotenv.config({ path: './order-booking-automation/.env' });

async function verifyOrders() {
    const orders = await getInvoiceOrders(250);
    console.log("Filtered Orders from Row 250:");
    console.log(orders.slice(0, 5)); 
}
verifyOrders();
