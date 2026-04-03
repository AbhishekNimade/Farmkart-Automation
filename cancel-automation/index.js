import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(import.meta.dirname, '../order-booking-automation/.env') });

import { chromium } from 'playwright';
import { fetchOrderIdFromRow, getNextEmptyRow, updateCancelStatus } from './sheets.js';
import { clickAndHighlight, injectVisualCursor } from '../shared-utils/visual-click.js';

const wait = (ms) => new Promise(res => setTimeout(res, ms));

// ─────────────────────────────────────────────
// CLI Arguments
// ─────────────────────────────────────────────
const args = process.argv.slice(2);
let inputValue = null;
let limit = 0;

// Support both --startRow (UI sends this) and --orderId
const startRowIdx = args.indexOf('--startRow');
if (startRowIdx !== -1 && args[startRowIdx + 1]) inputValue = args[startRowIdx + 1].trim();

const orderIdIdx = args.indexOf('--orderId');
if (orderIdIdx !== -1 && args[orderIdIdx + 1]) inputValue = args[orderIdIdx + 1].trim();

const limitIdx = args.indexOf('--limit');
if (limitIdx !== -1 && args[limitIdx + 1]) limit = parseInt(args[limitIdx + 1], 10) || 0;

// ─────────────────────────────────────────────
// Input Detection
// 4 digits or fewer → Row Number
// 5+ digits → Direct Order ID
// ─────────────────────────────────────────────
function detectInputType(val) {
    if (!val || isNaN(parseInt(val))) return null;
    return val.length <= 4 ? 'row' : 'orderId';
}

// ─────────────────────────────────────────────
// Date: "2026-03-19" → "19/03/2026"
// ─────────────────────────────────────────────
function formatDateForSheet(raw) {
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : raw;
}

// ─────────────────────────────────────────────
// Extract order date robustly from the page
// ─────────────────────────────────────────────
async function extractOrderDate(page) {
    try {
        const dateStr = await page.evaluate(() => {
            // Walk all elements and look for one containing "Order Date"
            const all = Array.from(document.querySelectorAll('*'));
            for (const el of all) {
                const text = (el.innerText || '').trim();
                // Match "Order Date: 2026-03-19" or "Order Date 2026-03-19"
                const m = text.match(/Order Date[:\s]+(\d{4}-\d{2}-\d{2})/i);
                if (m) return m[1];
            }
            return '';
        });

        if (dateStr) {
            const formatted = formatDateForSheet(dateStr);
            console.log(`📅 Order Date: ${dateStr} → ${formatted}`);
            return formatted;
        }
    } catch (e) {
        console.log(`⚠️ Date extraction error: ${e.message}`);
    }
    console.log('⚠️ Could not extract Order Date — Col B will be left blank.');
    return '';
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
(async () => {
    console.log("=========================================");
    console.log("🚫 Farmkart Order Cancellation Automation");
    console.log("=========================================\n");

    const inputType = detectInputType(inputValue);
    if (!inputValue || !inputType) {
        console.error("❌ No valid input. Use --startRow <rowNo|orderId>");
        process.exit(1);
    }

    const modeLabel = inputType === 'row' ? 'Row Number Mode' : 'Direct Order ID Mode';
    console.log(`📥 Input: "${inputValue}" → ${modeLabel}`);

    // ── Build order list ──
    let ordersToProcess = [];

    if (inputType === 'row') {
        const startRow = parseInt(inputValue, 10);
        const maxRows = limit > 0 ? limit : 50;
        console.log(`📡 Scanning sheet from Row ${startRow} (max ${maxRows} rows)...`);

        for (let r = startRow; r < startRow + maxRows; r++) {
            try {
                const orderId = await fetchOrderIdFromRow(r);
                if (orderId) {
                    ordersToProcess.push({ rowNo: r, orderId, isDirectId: false });
                    if (limit > 0 && ordersToProcess.length >= limit) break;
                }
            } catch (e) {
                console.log(`⚠️ Row ${r}: ${e.message}`);
            }
        }

        if (ordersToProcess.length === 0) {
            console.log("⚠️ No valid orders found. Check that Col C has Order IDs and Col B is blank.");
            process.exit(0);
        }
        console.log(`✅ ${ordersToProcess.length} order(s) to process.\n`);

    } else {
        // Direct Order ID — find next empty row in Sheet
        console.log(`📦 Direct Order ID: ${inputValue}`);
        try {
            const nextRow = await getNextEmptyRow();
            ordersToProcess.push({ rowNo: nextRow, orderId: inputValue, isDirectId: true });
            console.log(`✅ Will write to Sheet Row: ${nextRow}\n`);
        } catch (error) {
            console.error("❌ Cannot read sheet to find next row:", error.message);
            console.error("   → Make sure the sheet is shared with the service account!");
            process.exit(1);
        }
    }

    // ── Browser ──
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    context.on('page', async (p) => { await injectVisualCursor(p).catch(() => null); });
    const page = await context.newPage();
    await injectVisualCursor(page);

    let isLoggedIn = false;
    const ensureLogin = async () => {
        if (isLoggedIn) return;
        console.log("🚪 Clearing session via logout URL...");
        await page.goto("https://kart.farm:8443/Farmkart/index.jsp?status=logout", { waitUntil: "domcontentloaded" });
        await wait(2000);
        await page.goto("https://kart.farm:8443/Farmkart/index.jsp", { waitUntil: "domcontentloaded" });
        await wait(1500);

        if (await page.locator('input[name="username"]').count() > 0) {
            console.log("⌨️ Logging in...");
            await page.fill('input[name="username"]', process.env.FARMKART_USERNAME);
            await page.fill('input[name="password"]', process.env.FARMKART_PASSWORD);
            await wait(800);
            await Promise.all([
                page.waitForNavigation({ waitUntil: "domcontentloaded" }),
                clickAndHighlight(page, 'button:has-text("Login")')
            ]);
            console.log("✅ Logged in.");
        } else {
            console.log("✅ Session already active.");
        }
        isLoggedIn = true;
    };

    let processed = 0;

    for (const order of ordersToProcess) {
        const { rowNo, orderId, isDirectId } = order;

        try {
            console.log(`\n=========================================`);
            console.log(`🚫 Order: ${orderId}  |  Sheet Row: ${rowNo}`);
            console.log(`=========================================`);

            await ensureLogin();
            await page.bringToFront();

            // ── 1. Load Order Details ──
            const orderUrl = `https://kart.farm:8443/Farmkart/orderdetails.jsp?orderid=${orderId}`;
            console.log(`🌐 Loading: ${orderUrl}`);
            await page.goto(orderUrl, { waitUntil: "domcontentloaded" });
            await wait(2000);

            // ── 2. Extract Order Date ──
            const orderDateFormatted = await extractOrderDate(page);

            // ── 3. Click "Cancel Order" (goes to cancelOrderInventory.jsp) ──
            console.log("👆 Clicking 'Cancel Order'...");
            const cancelBtnSelector = 'a[href*="cancelOrderInventory.jsp"], a.btn-danger:has-text("Cancel"), a:has-text("Cancel Order")';
            const cancelBtn = page.locator(cancelBtnSelector).first();

            if (await cancelBtn.count() === 0) {
                console.log("❌ 'Cancel Order' button not found. Skipping this order.");
                continue;
            }

            await Promise.all([
                page.waitForNavigation({ waitUntil: "domcontentloaded" }),
                clickAndHighlight(page, cancelBtnSelector)
            ]);

            console.log("✅ On cancel page.");
            await wait(2500);

            // ── 4. Fill Batch No & Shelf Code per product ──
            console.log("🔍 Finding product rows...");

            // Each product row: readonly inputs (Product, BatchNo, Expiry, Qty) + Scan input + Shelf dropdown
            // Get all "Scan Barcode" inputs — one per product
            const scanInputsLoc = page.locator('input[placeholder*="Scan" i], input[placeholder*="Barcode" i]');
            const productCount = await scanInputsLoc.count();
            console.log(`📦 ${productCount} product(s) found.`);

            // Get all readonly inputs (Product=0, Batch=1, Expiry=2, Qty=3 for first product,
            // then 4,5,6,7 for second product etc.)
            const readonlyInputs = page.locator('input[readonly]');

            for (let i = 0; i < productCount; i++) {
                console.log(`\n▶️ Product ${i + 1} / ${productCount}`);

                // Visual Row Matcher: Match Scan Barcode to its Batch No by vertical position
                const scanInput = scanInputsLoc.nth(i);
                await scanInput.scrollIntoViewIfNeeded();

                const batchNo = await page.evaluate((idx) => {
                    const scans = Array.from(document.querySelectorAll('input[placeholder*="Scan" i], input[placeholder*="Barcode" i]'));
                    const targetScan = scans[idx];
                    if (!targetScan) return "";

                    const targetRect = targetScan.getBoundingClientRect();
                    const targetY = targetRect.top + targetRect.height / 2;

                    // 1. Find ALL readonly inputs in the SAME visual row (y-tolerance: 15px)
                    const allReadonly = Array.from(document.querySelectorAll('input[readonly]'));
                    const rowReadonly = allReadonly.filter(el => {
                        const rect = el.getBoundingClientRect();
                        const midY = rect.top + rect.height / 2;
                        return Math.abs(midY - targetY) < 15;
                    });

                    // 2. Sort them horizontally (left to right)
                    rowReadonly.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

                    // 3. Expected standard sequence in a row: 
                    // [0:Product Name] [1:Batch No] [2:Expiry] [3:Qty] -> Scan Barcode
                    if (rowReadonly.length >= 2) {
                        // The Batch No is the 2nd readonly field usually, but let's filter for valid batch-like content
                        // to be extra robust against hidden/extra fields.
                        const batchCandidate = rowReadonly.find((el, index) => {
                            const val = el.value.trim();
                            // Batch No is index 1 OR index 2 (if hidden product field exists), 
                            // not a date, not a tiny number (qty).
                            return index > 0 && val && !/^\d{4}-\d{2}-\d{2}$/.test(val) && (isNaN(Number(val)) || val.length > 3);
                        });
                        return batchCandidate ? batchCandidate.value.trim() : rowReadonly[1].value.trim();
                    }
                    
                    // Fallback to absolute preceding logic if row-based failed
                    const preceding = allReadonly.filter(el => (el.compareDocumentPosition(targetScan) & Node.DOCUMENT_POSITION_PRECEDING));
                    return (preceding.length >= 3) ? preceding[preceding.length - 3].value.trim() : "";
                }, i);

                if (!batchNo) {
                    console.log(`⚠️ Could not detect Batch No for product ${i + 1}. Skipping scan fill.`);
                } else {
                    console.log(`🏷️ Row ${i+1} Batch No detected: [${batchNo}]`);
                    await scanInput.fill(batchNo);
                    await scanInput.press('Tab');
                    await wait(500);
                    console.log(`✅ Filled Scan Barcode for Row ${i + 1}`);
                }

                // Select Shelf Code "O-1"
                // All dropdowns except #cancelreason
                const productShelfSelects = page.locator('select:not(#cancelreason)');
                const shelfCount = await productShelfSelects.count();

                if (shelfCount > i) {
                    const shelfSel = productShelfSelects.nth(i);
                    try {
                        // Try label "O-1"
                        await shelfSel.selectOption({ label: 'O-1' }).catch(async () => {
                            // Try value "O-1"
                            await shelfSel.selectOption({ value: 'O-1' }).catch(async () => {
                                // Select first non-empty
                                await shelfSel.selectOption({ index: 1 }).catch(() => null);
                            });
                        });
                        console.log(`✅ Shelf Code selected.`);
                    } catch (e) {
                        console.log(`⚠️ Shelf Code select error: ${e.message}`);
                    }
                }
                await wait(300);
            }

            // ── 5. Select Cancel Reason ──
            console.log("\n📋 Selecting cancel reason...");
            try {
                // Force the value via JS (handles Select2 widget too)
                await page.evaluate(() => {
                    const sel = document.getElementById('cancelreason');
                    if (sel) {
                        sel.value = 'Wrong order placed';
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
                console.log("✅ Cancel reason: 'Wrong order placed'");
            } catch (e) {
                console.log(`⚠️ Could not set cancel reason: ${e.message}`);
            }
            await wait(500);

            // ── 6. Click Cancel Order submit ──
            console.log("👆 Submitting cancellation...");
            const submitSelector = '#submitcancel_btn, button:has-text("Cancel Order")';
            const submitBtn = page.locator(submitSelector).first();

            if (await submitBtn.count() === 0) {
                console.log("❌ Submit button not found. Skipping.");
                continue;
            }

            await clickAndHighlight(page, submitSelector);
            await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => null);
            await wait(2000);
            console.log("✅ Cancellation submitted!");

            // ── 7. Update Google Sheet ──
            console.log(`\n📊 Updating Google Sheet Row ${rowNo}...`);
            try {
                // isDirectId=true → write orderId to Col C too
                await updateCancelStatus(
                    rowNo,
                    orderDateFormatted,
                    isDirectId ? orderId : null,
                    'Other State'
                );
            } catch (sheetErr) {
                console.error(`❌ Sheet update failed: ${sheetErr.message}`);
                console.error("   → Check if sheet is shared with service account email!");
            }

            processed++;
            console.log(`\n🎉 Done! Order ${orderId} cancelled. (${processed} processed)`);

        } catch (error) {
            console.error(`\n❌ Error on Order ${orderId} (Row ${rowNo}): ${error.message}`);
        }
    }

    console.log(`\n=========================================`);
    console.log(`🏁 Finished! ${processed} / ${ordersToProcess.length} orders cancelled.`);
    console.log(`=========================================\n`);

    await browser.close();
    process.exit(0);
})();
