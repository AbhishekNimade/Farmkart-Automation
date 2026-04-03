// =====================================================
// File Name : index.js
// Project   : Farmkart OFD Automation
// Author    : Abhishek Nimade
// Purpose   : Automate Out For Delivery + Daily Report
// =====================================================


import "dotenv/config";

import { chromium } from "playwright";
import readline from "readline";
import { getOrders, updateSheetRemark } from "./sheets/googleSheets.js";
import { sendWhatsAppAlert } from "./utils/whatsapp.js"; // ✅ STEP 5
import { injectVisualCursor } from "../shared-utils/visual-click.js";

// ================= UTILS =================
const wait = (ms) => new Promise(res => setTimeout(res, ms));

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const ask = (q) => new Promise(res => rl.question(q, res));

// ================= DAILY REPORT COUNTERS =================
let totalChecked = 0;
let ofdDone = 0;
let backendIssues = 0;
let skipped = 0;

// ================= MAIN =================
(async () => {
    console.log("🚀 Farmkart OFD Automation Started");

    // ================= INPUT HANDLING (Refactored for Web) =================
    // Check for CLI arguments first (passed by server.js)
    const args = process.argv.slice(2);
    const startRowIdx = args.indexOf('--startRow');
    const limitIdx = args.indexOf('--limit');

    let startRow, limit;

    if (startRowIdx > -1) {
        startRow = parseInt(args[startRowIdx + 1], 10);
        limit = limitIdx > -1 ? parseInt(args[limitIdx + 1], 10) : 0;
        console.log(`🤖 Auto-Start Mode: Row ${startRow}, Limit ${limit}`);
        rl.close(); // Close unused readline
    } else {
        // Fallback to manual input
        startRow = parseInt(await ask("👉 Start ROW number: "), 10);
        limit = parseInt(await ask("👉 Max orders (0 = unlimited): "), 10);
        rl.close();
    }

    if (isNaN(startRow)) {
        console.log("❌ Invalid start row. Exiting.");
        process.exit(1);
    }

    // ================= BROWSER =================
    const browser = await chromium.launch({
        headless: false,
        slowMo: 80, // fast + safe
    });

    const page = await browser.newPage();
    await injectVisualCursor(page);

    // ================= LOGIN =================
    await page.goto("https://kart.farm:8443/Farmkart/index.jsp?status=logout");
    await wait(600);

    await page.fill('input[name="username"]', process.env.FK_USERNAME);
    await page.fill('input[name="password"]', process.env.FK_PASSWORD);
    await page.click('button:has-text("Login")');

    await page.waitForURL("**/dashboard.jsp", { timeout: 10000 });
    console.log("✅ Login successful");

    // ================= READ SHEET =================
    const orders = await getOrders();
    let processed = 0;

    // ================= MAIN LOOP =================
    for (const o of orders) {

        if (o.sheetRow < startRow) continue;

        if (!o.orderId) {
            console.log(`🛑 Order ID blank at row ${o.sheetRow}. STOP.`);
            break;
        }

        if (limit > 0 && processed >= limit) break;

        totalChecked++;

        // ================= SKIP CASES =================
        if (o.orderStatus === "Completed") {
            await updateSheetRemark(o.sheetRow, "COMPLETED (Skipped by AI)");
            skipped++;
            continue;
        }

        if (o.orderStatus === "Cancelled") {
            await updateSheetRemark(o.sheetRow, "CANCELLED (Skipped by AI)");
            skipped++;
            continue;
        }

        if (!o.awb || !o.partner || o.ofdStatus.includes("OFD")) {
            skipped++;
            continue;
        }

        console.log(`\n➡️ ROW ${o.sheetRow}`);
        console.log(`   Order ID : ${o.orderId}`);
        console.log(`   Partner  : ${o.partner}`);
        console.log(`   AWB      : ${o.awb}`);

        // ================= ORDER PAGE =================
        await page.goto(
            `https://kart.farm:8443/Farmkart/orderdetails.jsp?orderid=${o.orderId}`,
            { waitUntil: "domcontentloaded" }
        );

        // ================= TRY OFD CLICK (FAST RETRY) =================
        let popupOpened = false;

        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const btn = page.locator(
                    'a[data-target="#trackingInfo"]:has-text("Out for delivery")'
                );
                await btn.click({ force: true });

                await page.locator("#trackingInfo")
                    .waitFor({ state: "visible", timeout: 2500 });

                popupOpened = true;
                break;
            } catch {
                console.log(`⚠️ Attempt ${attempt}: popup not opened`);
                await wait(300);
            }
        }

        // ================= BACKEND ISSUE =================
        if (!popupOpened) {
            backendIssues++;

            const alertMsg = `🚨 OFD Backend Issue

Row: ${o.sheetRow}
Order ID: ${o.orderId}
AWB: ${o.awb}
Partner: ${o.partner}

Reason: Delivery boy not assigned
Action: Backend team intervention needed`;

            console.log("❌ Backend issue: Delivery boy not assigned");

            await updateSheetRemark(
                o.sheetRow,
                "NEEDS BACKEND CHANGE (Delivery boy not assigned)"
            );

            // 📲 STEP 5 — WhatsApp alert
            await sendWhatsAppAlert(alertMsg);

            continue;
        }

        // ================= FILL POPUP =================
        const modal = page.locator("#trackingInfo");

        // Partner select (safe)
        const select = modal.locator("#courierName");
        const options = await select.locator("option").all();

        let selected = false;
        for (const opt of options) {
            const t = (await opt.innerText()).toLowerCase();
            if (
                (o.partner.toLowerCase().includes("delhivery") && t.includes("delhivery")) ||
                (o.partner.toLowerCase().includes("india") && t.includes("post"))
            ) {
                await select.selectOption(await opt.getAttribute("value"));
                selected = true;
                break;
            }
        }

        if (!selected) {
            await updateSheetRemark(o.sheetRow, "COURIER NOT FOUND (Skipped by AI)");
            skipped++;
            continue;
        }

        await modal.locator('input[name="trackingNumber"]').fill(o.awb);

        const url = o.partner.toLowerCase().includes("delhivery")
            ? "https://www.delhivery.com/tracking"
            : "https://www.indiapost.gov.in/";

        await modal.locator("#trackingUrl").fill(url);

        await modal.locator('button:has-text("Submit")').click({ force: true });
        await wait(600);

        // ================= SUCCESS =================
        await updateSheetRemark(o.sheetRow, "OFD - DONE (AI Automation)");
        console.log(`✅ OFD DONE → Row ${o.sheetRow}`);
        ofdDone++;
        processed++;
    }

    // ================= DAILY REPORT (TERMINAL) =================
    console.log("\n📊 Daily OFD Report");
    console.log(`- Total checked: ${totalChecked}`);
    console.log(`- OFD Done: ${ofdDone}`);
    console.log(`- Backend issues: ${backendIssues}`);
    console.log(`- Skipped: ${skipped}`);

    // ================= DAILY REPORT (WHATSAPP) =================
    await sendWhatsAppAlert(
        `📊 Daily OFD Report

Total checked: ${totalChecked}
OFD Done: ${ofdDone}
Backend issues: ${backendIssues}
Skipped: ${skipped}`
    );

    console.log("\n🎉 Automation finished safely");

    await browser.close();
    console.log("🧹 Browser closed automatically");
})();
