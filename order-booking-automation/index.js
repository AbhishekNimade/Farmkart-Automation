// =====================================================
// File Name : index.js
// Project   : Order Booking Automation (Farmkart)
// Author    : Abhishek Nimade
// Purpose   :
//  - Take start row from terminal
//  - Read pending orders from Google Sheet
//  - Scrape Farmkart invoice (Tab 1)
//  - Book order on Delhivery (Tab 2)
// =====================================================

import dotenv from "dotenv";
dotenv.config();

import readline from "readline";
import { chromium } from "playwright";
import { readPendingOrders, updateDeliveryCharge, updateOrderWeight, updateAwb, updateBookingStatus, updateDeliveryPartner, updateBookingDate } from "./config/sheet.js";
import { injectVisualCursor } from "../shared-utils/visual-click.js";
import { loginFarmkart, scrapeInvoiceDetails } from "./modules/farmkartInvoice.js";
import { loginDelhivery } from "./modules/delhiveryLogin.js";
import { createOrder } from "./modules/delhiveryOrder.js";

// -----------------------------
// Terminal input interface
// -----------------------------
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Helper function
function ask(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

// -----------------------------
// Main function
// -----------------------------
// Helper function to wait
const wait = (ms) => new Promise(res => setTimeout(res, ms));

async function main() {
    // Check for CLI args (Auto Mode)
    const args = process.argv.slice(2);
    const startRowIdx = args.indexOf('--startRow');
    const isAuto = args.includes('--auto');

    console.log("\n===========================================");
    console.log("🚀 ORDER BOOKING AUTOMATION STARTED");
    console.log("===========================================\n");

    // -----------------------------
    // ENV CHECK
    // -----------------------------
    if (
        !process.env.FARMKART_USERNAME ||
        !process.env.FARMKART_PASSWORD ||
        !process.env.DELHIVERY_EMAIL ||
        !process.env.DELHIVERY_PASSWORD ||
        !process.env.SHEET_ID
    ) {
        console.error("❌ Required ENV variables missing in .env");
        process.exit(1);
    }

    // -----------------------------
    // START ROW INPUT
    // -----------------------------
    let startRowInput;

    if (startRowIdx > -1) {
        startRowInput = args[startRowIdx + 1];
        console.log(`🤖 Auto-Start Mode: Row ${startRowInput}`);
        rl.close();
    } else {
        startRowInput = await ask("👉 Please enter START ROW number (e.g., 4805): ");
    }

    // Validate input
    const startRow = parseInt(startRowInput);
    if (isNaN(startRow) || startRow <= 0) {
        console.error("❌ Invalid START ROW entered. Exiting.");
        rl.close();
        process.exit(1);
    }

    // -----------------------------
    // READ GOOGLE SHEET
    // -----------------------------
    const orders = await readPendingOrders(startRow);

    if (!orders || orders.length === 0) {
        console.log("⚠️ No pending orders found.");
        rl.close();
        return;
    }

    console.log(`📦 Found ${orders.length} pending orders to process.`);

    // -----------------------------
    // ORDER COUNT INPUT
    // -----------------------------
    // Check if limit is passed via CLI args
    const limitArgIdx = args.indexOf('--limit');
    let orderCountInput;
    let orderCount;

    if (limitArgIdx > -1) {
        // Use CLI argument if present
        orderCountInput = args[limitArgIdx + 1];
        orderCount = parseInt(orderCountInput || "0");
        console.log(`🤖 Auto-Limit Mode: ${orderCount === 0 ? "ALL" : orderCount}`);
    } else {
        // Otherwise ask user
        if (orders.length > 0) {
            orderCountInput = await ask("👉 How many orders to book? (Enter 0 for ALL): ");
            orderCount = parseInt(orderCountInput || "0");
        } else {
            orderCount = 0;
        }
    }

    if (isNaN(orderCount) || orderCount < 0) {
        console.log("❌ Invalid order count. Using ALL.");
        orderCount = 0;
    }

    if (orderCount > 0) {
        console.log(`🎯 Limit set: Processing first ${orderCount} pending orders.`);

        // If user wants N orders, keep first N. remove rest.
        if (orderCount < orders.length) {
            orders.splice(orderCount); // Modifies in place
        }
    } else {
        console.log("∞ Processing ALL pending orders.");
    }

    console.log(`\n✅ Start Row: ${startRow} | Order Count: ${orderCount === 0 ? "ALL" : orderCount}`);

    rl.close();

    console.log(`\n✅ Start Row: ${startRow} | Order Count: ${orderCount === 0 ? "ALL" : orderCount}`);
    console.log(`📌 Processing ${orders.length} orders...`);

    // -----------------------------
    // LAUNCH BROWSER & TABS
    // -----------------------------
    console.log("\n🌐 Launching Browser...");
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    // Create 2 Separate Tabs
    console.log("   - Opening Tab 1: Farmkart");
    const pageFarmkart = await context.newPage();
    await injectVisualCursor(pageFarmkart);

    console.log("   - Opening Tab 2: Delhivery");
    const pageDelhivery = await context.newPage();
    await injectVisualCursor(pageDelhivery);

    // -----------------------------
    // 1. LOGIN PHASE (Parallel or Sequential)
    // -----------------------------
    console.log("\n🔐 STARTING LOGIN PHASE...");

    // Login Farmkart (Tab 1)
    await pageFarmkart.bringToFront();
    await loginFarmkart(pageFarmkart);

    // Login Delhivery (Tab 2)
    await pageDelhivery.bringToFront();
    await loginDelhivery(pageDelhivery);

    console.log("\n✅ ALL LOGINS SUCCESSFUL. STARTING ORDER LOOP...");

    // -----------------------------
    // 2. PROCESSING LOOP
    // -----------------------------
    for (const [index, order] of orders.entries()) {
        console.log(`\n------------------------------------------------`);
        console.log(`➡️ Processing Order ${index + 1}/${orders.length}`);
        console.log(`   ID: ${order.orderId} | Sheet Row: ${order.rowNumber}`);
        console.log(`------------------------------------------------`);

        // OPTIONAL: Skip if Box Size is missing (User Requirement)
        if (!order.customerDetails.boxSize || order.customerDetails.boxSize.trim() === "") {
            console.log("⚠️ SKIPPING ORDER: 'Box Size' is missing in Google Sheet (Col G).");
            continue;
        }

        try {
            // A. SCAPE FARMKART (Tab 1)
            await pageFarmkart.bringToFront();
            console.log(`📄 [Farmkart] Opening Invoice for info...`);
            let orderData = await scrapeInvoiceDetails(pageFarmkart, order.orderId);

            // ---------------------------------------------------------
            // MERGE SHEET DATA (STRICT REQUIREMENT)
            // ---------------------------------------------------------
            // We override/augment scraped data with strict Sheet columns

            // 1. Customer Name (Col J) -> First/Last Split
            const sheetName = (order.customerDetails.name || "").trim();
            const nameParts = sheetName.split(/\s+/).filter(p => p);
            let firstName = sheetName;
            let lastName = sheetName;

            if (nameParts.length === 2) {
                firstName = nameParts[0];
                lastName = nameParts[1];
            } else if (nameParts.length >= 3) {
                firstName = nameParts[0];
                lastName = nameParts.slice(1).join(" ");
            } else if (nameParts.length === 1) {
                firstName = sheetName;
                lastName = sheetName;
            }

            // 2. Address Line 1 (Strict Format)
            const m = (order.customerDetails.addressPart || "").trim();
            const n = (order.customerDetails.village || "").trim();
            const o = (order.customerDetails.tehsil || "").trim();
            const p = (order.customerDetails.district || "").trim();

            const addressString = `Address - ${m}, Village - ${n}, Tehsil - ${o}, District - ${p}`;

            // 3. Override Customer Object
            orderData.customer = {
                firstName: firstName,
                lastName: lastName,
                phone: order.customerDetails.phone, // Col I
                address: addressString,
                pincode: order.customerDetails.pincode, // Col J
                state: order.customerDetails.state, // Col O
                district: n, // Col N (Used for City)
                country: "India"
            };

            // 4. Box Size (Col G)
            orderData.boxSize = order.customerDetails.boxSize;

            // 5. Payment Details (From Farmkart Invoice)
            if (orderData.payment.isCod) {
                console.log(`   💰 Payment (Invoice): COD ₹${orderData.payment.amount}`);
            } else {
                console.log(`   💰 Payment (Invoice): Prepaid (COD is 0 or not found)`);
            }

            // 6. Calculate Total Product Weight (Base for sheet Col V)
            const calculatedWeightKg = orderData.products.reduce((sum, p) => sum + ((p.weight || 0.5) * (p.qty || 1)), 0);
            console.log(`   ⚖️  Calculated Total Product Weight: ${calculatedWeightKg.toFixed(3)} kg`);

            // 7. RECORD WEIGHT IMMEDIATELY (Compulsory requirement)
            await updateOrderWeight(order.rowNumber, calculatedWeightKg);

            // B. CREATE DELHIVERY ORDER (Tab 2)
            await pageDelhivery.bringToFront();
            console.log(`\n🚚 [Delhivery] Switching tab to create order...`);
            const orderResult = await createOrder(pageDelhivery, orderData);

            // C. UPDATE SHEET (AWB, Partner, Weight, Price, Date)
            if (orderResult) {
                // 1. Record AWB (Col C)
                if (orderResult.awb) {
                    await updateAwb(order.rowNumber, orderResult.awb);
                }

                // 2. Record Delivery Partner (Col D)
                await updateDeliveryPartner(order.rowNumber, "Delhivery");

                // 3. Record Booking Date (Col H)
                if (orderResult.bookingDate) {
                    await updateBookingDate(order.rowNumber, orderResult.bookingDate);
                }

                // 4. Record Delivery Charges (Col W) - Weight (Col V) is already updated above
                if (orderResult.shippingCost > 0) {
                    console.log(`   📝 Recording recovered price ₹${orderResult.shippingCost} to Column W.`);
                    await updateDeliveryCharge(order.rowNumber, orderResult.shippingCost);
                } else {
                    console.log(`   ⚠️ [SKIP] Shipping Cost is 0. Column W (Price) NOT updated.`);
                }
            }

            // EXIT LOOP IF STOP SIGNAL RECEIVED (Moved after sheet update)
            if (orderResult && orderResult.stopLoop) {
                console.log("\n🛑 STOP SIGNAL RECEIVED: Stopping order loop after first successful selection.");
                break;
            }

            console.log(`\n✅ [Order ${order.orderId}] Form Successfully Filled, AWB Sync'd, and Pickup Scheduled.`);
            // console.log("🛑 stopping loop after one successful order completion as requested.");
            // break;

        } catch (error) {
            console.error(`\n❌ ERROR Processing Order ${order.orderId}:`);
            console.error(`   ${error.message}`);

            if (pageDelhivery.isClosed()) {
                console.error("   🛑 Delhivery page was closed unexpectedly. Stopping loop.");
                break;
            }

            if (error.message.includes("SKIP_REASON:")) {
                const reason = error.message.replace("SKIP_REASON: ", "");
                console.log(`   ⚠️ Skiping Order: ${reason}`);

                // Update Step Status with Skip Reason (Col F)
                await updateBookingStatus(order.rowNumber, `Skipped: ${reason}`);

                // Navigate back to reset state
                console.log("   🔄 Resetting Delhivery page for next order...");
                await pageDelhivery.goto("https://one.delhivery.com/orders/forward/create", { waitUntil: 'domcontentloaded' }).catch(() => { });
            } else {
                console.log("   🛑 Unhandled error. Stopping or continuing based on environment...");
                await updateBookingStatus(order.rowNumber, `Error: ${error.message.slice(0, 50)}`).catch(() => { });

                // ⏸️ PAUSE ON ERROR (OR AUTO RESET)
                console.log("\n   ⚠️  ERROR OCCURRED. Form is left filled for inspection.");

                if (isAuto) {
                    console.log("🔄 Auto-Resetting page in 10 seconds...");
                    await wait(10000);
                } else {
                    const rlErr = readline.createInterface({ input: process.stdin, output: process.stdout });
                    await new Promise(resolve => rlErr.question("   👉 Press ENTER to reset page and continue to next order (or Ctrl+C to exit)...", () => {
                        rlErr.close();
                        resolve();
                    }));
                }

                await pageDelhivery.goto("https://one.delhivery.com/orders/forward/create", { waitUntil: 'domcontentloaded' }).catch(() => { });
            }

            // Continue to next order
            continue;
        }
    }

    console.log("\n🛑 Process Completed / Stopped.");

    // Resume stdin for final wait

    if (isAuto) {
        console.log("🏁 Auto-Exit: Closing browser.");
    } else {
        const rlFinal = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        await new Promise(resolve => rlFinal.question("👉 Press ENTER to close browser and exit...", resolve));
        rlFinal.close();
    }

    await browser.close();
}

// -----------------------------
// RUN
// -----------------------------
main().catch((err) => {
    console.error("❌ Unexpected Fatal Error:", err);
    process.exit(1);
});
