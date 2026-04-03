import { chromium } from 'playwright';
import { getInvoiceOrders } from './invoice-automation/sheets.js';
import dotenv from 'dotenv';
dotenv.config({ path: './order-booking-automation/.env' });

async function verifyOrders() {
    const orders = await getInvoiceOrders();
    console.log("Filtered Orders:");
    console.log(orders.slice(0, 5)); 
}
verifyOrders();
