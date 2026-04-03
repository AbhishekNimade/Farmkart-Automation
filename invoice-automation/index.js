import dotenv from 'dotenv';
import path from 'path';
import readline from 'readline';
dotenv.config({ path: path.join(import.meta.dirname, '../order-booking-automation/.env') });
import { chromium } from 'playwright';
import { fetchFilterAndExportDeliveries, updateInvoiceStatus } from './sheets.js';
import { clickAndHighlight, injectVisualCursor } from '../shared-utils/visual-click.js';
// Utility to sleep
const wait = (ms) => new Promise(res => setTimeout(res, ms));
import { analyzePage, attemptSelfHealing } from '../shared-utils/ai-utils.js';
import fs from 'fs';


// Smart Click Helper: Tries multiple strategies to find and click an element
const smartClick = async (tab, selector, text = "") => {
    console.log(`🎯 Attempting smart click for: ${text || selector}`);
    const locators = [
        tab.locator(selector).filter({ visible: true }).first(),
        ...(text ? [tab.locator(`text="${text}"`).filter({ visible: true }).first()] : []),
        tab.locator(`button:has-text("${text}")`).filter({ visible: true }).first(),
        tab.locator(`a:has-text("${text}")`).filter({ visible: true }).first()
    ];

    for (const loc of locators) {
        if (await loc.count() > 0) {
            await loc.scrollIntoViewIfNeeded().catch(() => null);
            await clickAndHighlight(tab, loc).catch(() => loc.click());
            return true;
        }
    }
    console.log(`⚠️ Smart click failed for: ${text || selector}`);
    return false;
};

// Action Memory Helper: Records successful actions to learn for the future
const recordAction = async (goal, selector, text) => {
    try {
        const memoryPath = path.join(path.dirname(import.meta.filename || '.'), 'action_memory.json');
        let memory = { history: [] };
        if (fs.existsSync(memoryPath)) {
            memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
        }
        memory.history.push({ goal, selector, text, timestamp: new Date().toISOString() });
        // Keep only last 50 actions
        if (memory.history.length > 50) memory.history.shift();
        fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
    } catch (e) { console.error("⚠️ Memory error:", e.message); }
};

(async () => {
    console.log("=========================================");
    console.log("🌱 Farmkart Invoice Automation");

    // Process CLI arguments 
    const args = process.argv.slice(2);
    let startRowIdx = -1;
    let limit = 0;

    // Support "--auto" flag for UI Triggered sessions
    if (args.includes('--auto')) {
        const rowArgIdx = args.indexOf('--startRow');
        if (rowArgIdx !== -1 && args[rowArgIdx + 1]) {
            startRowIdx = parseInt(args[rowArgIdx + 1], 10);
        }
        const limitArgIdx = args.indexOf('--limit');
        if (limitArgIdx !== -1 && args[limitArgIdx + 1]) {
            limit = parseInt(args[limitArgIdx + 1], 10);
        }
    }

    if (startRowIdx !== -1) {
        console.log(`👉 Starting from Sheet Row: ${startRowIdx}`);
    } else {
        console.log("👉 Manual execution mode (Prompting for Order URL)");
    }
    console.log("=========================================\n");

    let ordersToProcess = [];

    if (startRowIdx !== -1) {
        console.log("📡 Fetching data from Google Sheets...");
        try {
            // Modified `fetchFilterAndExportDeliveries` specifically for Invoice
            const data = await fetchFilterAndExportDeliveries();
            if (!data || data.length === 0) {
                console.log("⚠️ No valid orders found in the Sheet to Invoice.");
                return;
            }

            // In mapping returned, ensure your sheets.js matches `orderId` to Col C
            ordersToProcess = data.filter(r => r.sheetRow >= startRowIdx);

            // Apply limit to total rows CHECKED, not just processed
            if (limit > 0) {
                ordersToProcess = ordersToProcess.slice(0, limit);
            }

            console.log(`🚀 Checking ${ordersToProcess.length} row(s) starting from ${startRowIdx}.\n`);
        } catch (error) {
            console.error("❌ Error reading Google Sheet:", error.message);
            return;
        }
    } else {
        ordersToProcess = [{ orderId: null, sheetRow: null }];
    }

    // Initialize Playwright 
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    // Global listener: Automatically inject visual cursor into ANY new page or tab that opens
    context.on('page', async (newPage) => {
        await injectVisualCursor(newPage).catch(() => null);
    });

    const page = await context.newPage();
    await injectVisualCursor(page);

    let isLoggedIn = false;

    // Extracted Login Flow for Session Resiliency
    const ensureLogin = async () => {
        if (isLoggedIn) return;

        console.log("🚪 Forcing fresh session by hitting logout URL first...");
        await page.goto("https://kart.farm:8443/Farmkart/index.jsp?status=logout", { waitUntil: "domcontentloaded" });
        await wait(2000);

        console.log("🔐 Checking login status...");
        await page.goto("https://kart.farm:8443/Farmkart/index.jsp", { waitUntil: "domcontentloaded" });

        const isLoginPage = await page.locator('input[name="username"]').count();
        if (isLoginPage > 0) {
            console.log("⌨️ Filling login credentials...");
            await page.fill('input[name="username"]', process.env.FARMKART_USERNAME);
            await page.fill('input[name="password"]', process.env.FARMKART_PASSWORD);
            await wait(1000); // UI visual pause
            await Promise.all([
                page.waitForNavigation({ waitUntil: "domcontentloaded" }),
                clickAndHighlight(page, 'button:has-text("Login")')
            ]);
            console.log("✅ Logged in successfully.");
            await recordAction("login", 'button:has-text("Login")', "Login");
        } else {
            console.log("✅ Already logged in (or session is still active).");
        }
        isLoggedIn = true;
    };

    await ensureLogin();

    let inventoryTab = await context.newPage();
    await injectVisualCursor(inventoryTab);
    await inventoryTab.goto("https://kart.farm:8443/Farmkart/inventoryList.jsp", { waitUntil: "domcontentloaded" });

    // Function to handle automated stock transfer from other warehouses to Packaging
    const performStockTransfer = async (tab, requiredQty, deficit, productName, sourceWarehouseName = null) => {
        console.log(`🚀 Initiating Stock Transfer for "${productName}" (Deficit: ${deficit})...`);

        // Click "Product Transfer" button found on History/Inventory page
        const transferBtnSelector = 'button.btn-warning:has-text("Product Transfer"), a:has-text("Product Transfer")';
        
        const transferBtnLoc = tab.locator(transferBtnSelector).filter({ visible: true }).first();
        if (await transferBtnLoc.count() > 0) {
            await Promise.all([
                tab.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null),
                transferBtnLoc.click()
            ]);
        } else {
            const fallbackLoc = tab.locator(transferBtnSelector).first();
            if (await fallbackLoc.count() > 0) {
                 await Promise.all([
                    tab.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null),
                    fallbackLoc.click({ force: true })
                 ]);
            } else {
                console.log("❌ 'Product Transfer' button not found.");
                throw new Error("TRANSFER_BUTTON_NOT_FOUND");
            }
        }

        await wait(2000);
        // Ensure form is actually rendered
        await tab.waitForSelector('select#fromWareHouse, select[name="fromWarehouse"], select#toWareHouse', { state: 'visible', timeout: 10000 }).catch(() => null);

        console.log("📝 Filling Transfer Request form sequentially...");

        // 1. Expiry & Batch
        const expirySelect = tab.locator('select#expiry, select[name="expiryDate"], select[id*="expiry"]').first();
        if (await expirySelect.count() > 0 && await expirySelect.isVisible()) {
            console.log("👆 Selecting Expiry...");
            await expirySelect.selectOption({ index: 1 }).catch(() => null);
            await wait(1500); // 🕒 Wait for AJAX to populate Batch No
        } else {
            console.log("⏭️ Expiry dropdown not found or visible. Skipping...");
        }

        const batchSelect = tab.locator('select#batchno, select[name="batchNo"], select[id*="batchNo"]').first();
        if (await batchSelect.count() > 0 && await batchSelect.isVisible()) {
            console.log("👆 Selecting Batch No...");
            await batchSelect.selectOption({ index: 1 }).catch(() => null);
            await wait(1500); // 🕒 Wait for AJAX to populate From WareHouse
        } else {
            console.log("⏭️ Batch No dropdown not found or visible. Skipping...");
        }

        // 2. From Warehouse
        // **IMPORTANT:** Updated lowercase naming mismatch: user's HTML is "fromWareHouse"
        const fromWHSelect = tab.locator('select#fromWareHouse, select[name="fromWarehouse"]').first();
        if (await fromWHSelect.count() > 0 && await fromWHSelect.isVisible()) {
            console.log("👆 Selecting From Warehouse...");
            if (sourceWarehouseName) {
                const sourceValue = await fromWHSelect.evaluate((sel, name) => {
                    const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes(name.toLowerCase()));
                    return opt ? opt.value : null;
                }, sourceWarehouseName);
                if (sourceValue) {
                    console.log(`👆 Selected From Warehouse: ${sourceWarehouseName} (${sourceValue})`);
                    await fromWHSelect.selectOption(sourceValue);
                } else {
                    console.log(`⚠️ Source Warehouse '${sourceWarehouseName}' not found in dropdown. Selecting first available...`);
                    await fromWHSelect.selectOption({ index: 1 }); // Fallback
                }
            } else {
                await fromWHSelect.selectOption({ index: 1 }); // Usually Superstore
            }
            await wait(1500); // 🕒 Wait for AJAX to populate From ShelfCode
        }

        // 3. From ShelfCode
        const fromShelfSelect = tab.locator('select#fromShelfCode, select[name="fromShelfCode"]').first();
        if (await fromShelfSelect.count() > 0 && await fromShelfSelect.isVisible()) {
            console.log("👆 Selecting From Shelf Code...");
            await fromShelfSelect.selectOption({ index: 1 }).catch(() => null);
            await wait(1500); // 🕒 Wait for AJAX to populate To WareHouse
        }

        // 4. To Warehouse (Packaging)
        const toWHSelect = tab.locator('select#toWareHouse, select[name="toWarehouse"]').first();
        if (await toWHSelect.count() > 0 && await toWHSelect.isVisible()) {
            console.log("👆 Selecting To Warehouse (Packaging)...");
            const packagingValue = await toWHSelect.evaluate(sel => {
                const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes('packaging'));
                return opt ? opt.value : null;
            });

            if (packagingValue) {
                await toWHSelect.selectOption(packagingValue);
            } else {
                console.log("⚠️ Packaging not found in dropdown. Selecting first available...");
                await toWHSelect.selectOption({ index: 1 }); // Fallback
            }
            await wait(1500); // 🕒 Wait for AJAX to populate To ShelfCode
        }

        // 5. To ShelfCode
        const toShelfSelect = tab.locator('select#toShelfCode, select[name="toShelfCode"]').first();
        if (await toShelfSelect.count() > 0 && await toShelfSelect.isVisible()) {
            console.log("👆 Selecting To Shelf Code...");
            await toShelfSelect.selectOption({ index: 1 }).catch(() => null);
            await wait(1500); // 🕒 Wait for AJAX to populate Qty
        }

        // 6. Qty
        const qtySelect = tab.locator('select#qty, select[name="qty"], select[name="strQty"]').first();
        if (await qtySelect.count() > 0 && await qtySelect.isVisible()) {
            console.log(`👆 Selecting Transfer Qty: ${deficit}...`);
            try {
                // Must ensure string coercion for exact matching
                await qtySelect.selectOption({ label: String(deficit) });
            } catch (e) {
                console.log("⚠️ Exact Qty label not found in dropdown. Selecting first available (max)...");
                await qtySelect.selectOption({ index: 1 }).catch(() => null);
            }
            await wait(1000); // 🕒 Wait for JS handling of the select input, if any
        } else {
            const qtyInput = tab.locator('input#qty, input[name="qty"], input[name="strQty"]').first();
            if (await qtyInput.count() > 0) {
                console.log(`⌨️ Filling Transfer Qty input: ${deficit}...`);
                await qtyInput.fill(String(deficit));
                await wait(1000);
            }
        }

        console.log("👆 Clicking 'Add Request'...");
        const addRequestBtnSelector = 'button:has-text("Add Request"), .btn-success:has-text("Add Request")';
        const addRequestBtn = tab.locator(addRequestBtnSelector).first();

        // Make navigation wait safer/optional in case it doesn't navigate
        try {
            await Promise.all([
                tab.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 8000 }),
                clickAndHighlight(tab, addRequestBtnSelector)
            ]);
        } catch (e) {
            console.log("⚠️ Navigation timeout after Add Request. Checking if we are still on the form...");
            if (await addRequestBtn.count() > 0 && await addRequestBtn.isVisible()) {
                console.log("⚠️ 'Add Request' button still visible. Trying direct click...");
                await addRequestBtn.click().catch(() => null);
                await wait(2000);
            }
        }

        console.log("✅ Transfer Request Added. Now seeking approval...");
        // Expecting productTransferReport.jsp
        const actionBtnSelector = 'a[data-target="#ActionModel"], a.btn-primary:has-text("Action"), button:has-text("Action")';
        const actionBtnLoc = tab.locator(actionBtnSelector).first();

        // Wait a bit for the page to fully structure its DataTables if present
        await wait(2000);

        if (await actionBtnLoc.count() > 0) {
            console.log("↔️ Scrolling table to ensure 'Action' button is visible...");
            // Farmkart often uses DataTables with a wrapper for horizontal scrolling: '.dataTables_scrollBody' or '.table-responsive'
            await tab.evaluate(() => {
                const scrollWrappers = document.querySelectorAll('.dataTables_scrollBody, .table-responsive, table');
                scrollWrappers.forEach(w => w.scrollLeft = w.scrollWidth);
            }).catch(() => null);
            await wait(1000); // 🕒 Let UI settle after scroll

            // First, try to extract batch number directly from the onclick attribute BEFORE clicking
            const onclickText = await actionBtnLoc.getAttribute('onclick').catch(() => "");
            let batchToScan = "";
            let onclickMatch = onclickText ? onclickText.match(/setModalData\([^,]+,\s*['"]([^'"]+)['"]/) : null;
            if (onclickMatch && onclickMatch[1]) {
                batchToScan = onclickMatch[1].trim();
                console.log(`🔍 Extracted Batch No from onclick: [${batchToScan}]`);
            }

            // Ensure the button is fully in view for Playwright's click logic
            await actionBtnLoc.scrollIntoViewIfNeeded().catch(() => null);
            console.log("👆 Clicking 'Action' button forcefully...");
            // Use force:true to avoid interception by floating headers or table wrappers
            await actionBtnLoc.click({ force: true }).catch(async () => {
                // Utter fallback if Playwright still fails
                await tab.evaluate(btn => btn.click(), await actionBtnLoc.elementHandle());
            });
            await wait(2000); // Wait for modal

            if (!batchToScan) {
                // Extract Batch No from modal text as fallback
                const modalBodyText = await tab.innerText('.modal-body, #ActionModel').catch(() => "");
                
                // Account for the string without space format: "Batch No : 1189-1381-MACHINERYQty : 7"
                const qtyMatch = modalBodyText.match(/Batch No\s*:\s*(.+?)Qty/i);
                if (qtyMatch && qtyMatch[1]) {
                    batchToScan = qtyMatch[1].trim();
                } else {
                    const batchMatch = modalBodyText.match(/Batch No\s*:\s*([^\s]+)/);
                    batchToScan = batchMatch ? batchMatch[1].trim() : "";
                }
                console.log(`🔍 Extracted Batch No from Modal Text: [${batchToScan}]`);
            }

            console.log(`⌨️ Approving transfer by scanning Batch No: [${batchToScan}]`);
            // Fallback selectors for the scanning input in the modal
            const scanInputSelectors = [
                'input[id*="barcode"]',
                'input[name*="barcode"]',
                'input[placeholder*="Scan Barcode"]',
                '.modal-body input[type="text"]'
            ];

            let inputFound = false;
            for (const sel of scanInputSelectors) {
                const input = tab.locator(sel).first();
                if (await input.count() > 0 && await input.isVisible()) {
                    await input.fill(batchToScan);
                    await input.press('Enter');
                    inputFound = true;
                    break;
                }
            }

            if (!inputFound) {
                console.log("⚠️ Could not find barcode input in approval modal. Trying generic focus...");
                await tab.keyboard.type(batchToScan);
                await tab.keyboard.press('Enter');
            }

            await wait(2000);

            const approveBtnSelector = 'button:has-text("Approve"), .btn-success:has-text("Approve")';
            await Promise.all([
                tab.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => null),
                clickAndHighlight(tab, approveBtnSelector)
            ]);
            console.log("✅ Transfer approved and completed.");
        } else {
            console.log("⚠️ Action button not found on Report page. Manual approval might be needed.");
        }
    };

    let processed = 0;

    for (const o of ordersToProcess) {
        // Skip logic for already invoiced orders (Check outside retry loop to avoid duplicates/hangs)
        if (o.invoiceStatus === 'AI' || o.invoiceStatus === 'Yes') {
            console.log(`\n⏭️ Skipping Row ${o.sheetRow} (Order ${o.orderId}): Already marked as "${o.invoiceStatus}" in Google Sheets.`);
            continue;
        }

        let retryCount = 0;
        const maxRetries = 1;

        while (retryCount <= maxRetries) {
        try {
            let orderId = o.orderId;

            // Manual prompt fallback
            if (!orderId) {
                const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                orderId = await new Promise(resolve => {
                    rl.question("Please enter the Order ID (e.g. 211432): ", ans => resolve(ans.trim()));
                });
                rl.close();
            }

            console.log(`\n-----------------------------------------`);
            console.log(`📦 Processing Order ID: ${orderId} ${o.sheetRow ? `(Row ${o.sheetRow})` : ''}`);
            await ensureLogin();

            await page.bringToFront();
            const targetURL = `https://kart.farm:8443/Farmkart/orderdetails.jsp?orderid=${orderId}`;
            await page.goto(targetURL, { waitUntil: "domcontentloaded" });
            console.log(`✅ Loaded order details for Order ID ${orderId}`);

            // ==========================================
            // PRE-PHASE: CHECK ORDER STATUS BUTTON
            // ==========================================
            const processBtnSelector = 'a[onclick*="setNewOrderStatus(\'Order Processing\')"], a:has-text("Update Order status to Order Processing")';
            const processBtn = page.locator(processBtnSelector).first();

            if (await processBtn.count() > 0) {
                console.log("👆 Found 'Update Order status' button. Clicking it...");
                await page.bringToFront();

                // Click the initial button to trigger the modal
                await clickAndHighlight(page, processBtnSelector);

                // Wait for the custom modal to appear
                console.log("👆 Waiting for custom 'Confirm' modal to become visible...");
                const confirmBtnSelector = 'button.btn-admin_submit, button:has-text("Confirm")';

                // Use a locator that finds the visible button explicitly
                const confirmBtn = page.locator(confirmBtnSelector).filter({ visible: true }).first();

                try {
                    // Optimized: Reduced wait time and used direct click for the confirm button
                    // The modal is already triggered, we just need to hit 'Confirm' quickly
                    await confirmBtn.waitFor({ state: 'visible', timeout: 800 });
                    console.log("✅ Modal 'Confirm' button visible. Clicking...");

                    // Trigger direct click instead of slow clickAndHighlight for this specific modal action
                    await confirmBtn.click();
                    
                    // Reduced wait, just enough for the request to fire
                    await wait(500);
                    await page.waitForLoadState("domcontentloaded", { timeout: 3000 }).catch(() => null);

                    console.log("✅ Confirmed order processing via modal.");
                } catch (e) {
                    console.log("⚠️ Fast confirmation failed or timed out. Attempting fallback...");
                    await confirmBtn.click({ force: true }).catch(() => null);
                    await page.waitForLoadState("domcontentloaded", { timeout: 2000 }).catch(() => null);
                }

                await wait(2000);
            } else {
                console.log("⏭️ Bypassing 'Update Order status': Button not found. This order might already be in 'Processing' or a later state.");
            }

            console.log("👆 Clicking 'Generate New Invoice'...");
            await page.bringToFront();
            const invoiceLinkSelector = 'a[href*="invoice_new.jsp"], a[href*="addtoexpiry.jsp"], a:has-text("Generate New Invoice")';
            const invoiceLinkLoc = page.locator(invoiceLinkSelector).first();

            if (await invoiceLinkLoc.count() > 0) {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => null),
                    clickAndHighlight(page, invoiceLinkSelector)
                ]);
            } else {
                // If the specific link isn't found, try to jump to the URL directly as fallback
                console.log("⚠️ Could not find 'Generate New Invoice' button. Attempting direct URL jump...");
                await page.goto(`https://kart.farm:8443/Farmkart/invoice_new.jsp?orderid=${orderId}`, { waitUntil: "domcontentloaded" });
            }

            console.log("✅ Entered New Invoice ('Add Product Expiry') page.");
            await wait(2000);

            // ==========================================
            // PHASE 1: LOOP SETUP & PRODUCT EXTRACTION
            // ==========================================
            console.log("🔍 Extracting product IDs and names from form...");

            // Wait for the form to load on the new invoice page
            await page.waitForSelector('div[id^="productRow"], input[id^="productId_"]', { state: 'visible', timeout: 10000 }).catch(() => null);

            // Robust product counting: Check common ID patterns or count readonly inputs
            let productCount = 0;
            const idPatternLocs = page.locator('input[id^="productId_"]');
            const rowPatternLocs = page.locator('div[id^="productRow"]');
            
            if (await idPatternLocs.count() > 0) {
                productCount = await idPatternLocs.count();
            } else if (await rowPatternLocs.count() > 0) {
                productCount = await rowPatternLocs.count();
            } else {
                // Fallback: Check for any readonly input that might be a product name
                const readonlyInputs = page.locator('input[readonly].form-control');
                productCount = await readonlyInputs.count();
            }

            if (productCount === 0) {
                console.log("⚠️ No product containers found. Falling back to 1 to attempt manual detection.");
                productCount = 1;
            }

            console.log(`📦 Identified ${productCount} product(s) to process.`);

            // Loop through each product
            for (let i = 1; i <= productCount; i++) {
                console.log(`\n-----------------------------------------`);
                console.log(`▶️ Processing Product ${i} of ${productCount}...`);
                console.log(`-----------------------------------------`);

                // Semantic Product Extraction: Try IDs first, then labels, then position
                const productName = await page.locator(`#productId_${i}`).inputValue().catch(async () => {
                   return await page.locator(`text="Farmkart Product"`).locator('..').locator('input').nth(i-1).inputValue().catch(async () => {
                       const inputs = page.locator('input[type="text"][readonly], input.form-control[readonly]');
                       if (await inputs.count() >= i) return await inputs.nth(i - 1).inputValue();
                       return "Unknown Product";
                   });
                });

                const netQtyStr = await page.locator(`#netQty_${i}`).inputValue().catch(async () => {
                    return await page.locator(`text="Net Qty"`).locator('..').locator('input').nth(i-1).inputValue().catch(async () => {
                       const textInputs = page.locator('input[type="text"]');
                       if (await textInputs.count() >= i * 2) return await textInputs.nth((i * 2) - 1).inputValue();
                       return "1.0";
                    });
                });
                const netQty = parseFloat(netQtyStr) || 1.0;

                console.log(`📌 Found Product [${i}]: "${productName}", Net Qty: ${netQty}`);

                await inventoryTab.bringToFront();
                
                // --- Tab Health Check ---
                if (inventoryTab.isClosed()) {
                    console.log("⚠️ Inventory Tab was closed. Recreating...");
                    inventoryTab = await context.newPage();
                    await injectVisualCursor(inventoryTab);
                }
                
                // Ensure we are on the main inventory search page before starting a new search
                await inventoryTab.goto("https://kart.farm:8443/Farmkart/inventoryList.jsp", { waitUntil: "domcontentloaded" });
                await wait(2000);

                console.log(`⌨️ Searching for "${productName}" in Inventory...`);
                // Farmkart data tables often use standard text inputs with an 'aria-controls' attribute or a specific wrapper class.
                const searchInputLoc = inventoryTab.locator('input[type="search"], .dataTables_filter input, input[placeholder*="Search" i], input[aria-controls]').first();
                await searchInputLoc.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
                // Use the FULL product name for better accuracy
                await searchInputLoc.clear().catch(() => null);
                await searchInputLoc.fill(productName);

                console.log("👆 Clicking 'Search' button...");
                const searchBtnSelector = 'button:has-text("Search"), input[type="submit"][value="Search"], .btn-search, i.fa-search';
                await inventoryTab.locator(searchBtnSelector).first().click({ force: true }).catch(() => null);
                await wait(2500); // 🕒 Wait for DataTables sorting algorithm/server response

                console.log("👆 Clicking 'History' for the matched product...");
                // Precise selector to avoid clicking header or multiple buttons
                const historyBtnSelector = 'tbody tr td a:has-text("History"), tbody tr td button:has-text("History")';
                const historyBtn = inventoryTab.locator(historyBtnSelector).first();
                
                if (await historyBtn.count() > 0) {
                    await Promise.all([
                        inventoryTab.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null),
                        historyBtn.click({ force: true })
                    ]);
                    console.log("✅ Navigation to History page initiated.");
                } else {
                    console.log("⚠️ 'History' button not found in results table. Attempting smart click fallback...");
                    await smartClick(inventoryTab, historyBtnSelector, "History");
                }
                
                // Wait for the new page content to load (Inventory Product Details)
                await inventoryTab.waitForSelector('button:has-text("Stock Location"), .btn-primary:has-text("Stock Location")', { state: 'visible', timeout: 10000 }).catch(() => null);
                await wait(2000); 

                // ==========================================
                // PHASE 2: STOCK VERIFICATION (PACKAGING)
                // ==========================================
                let stockSufficient = false;
                while (!stockSufficient) {
                    console.log("👆 Clicking 'Stock Location'...");
                    await inventoryTab.bringToFront();
                    await clickAndHighlight(inventoryTab, 'button:has-text("Stock Location"), a:has-text("Stock Location")');
                    console.log("🔍 Extracting all warehouse quantities from modal (waiting for AJAX)...");

                    const stockRows = await inventoryTab.evaluate(async () => {
                        const waitInternal = (ms) => new Promise(r => setTimeout(r, ms));
                        
                        let rows = [];
                        for (let attempt = 0; attempt < 12; attempt++) { // Wait up to 6 seconds
                            const modal = document.querySelector('.modal-dialog, .modal-content, #StockLocationModel, .show.modal, .modal');
                            if (modal) {
                                const tables = Array.from(modal.querySelectorAll('table'));
                                const stockTable = tables.find(t => 
                                    t.innerText.toLowerCase().includes('packaging') || 
                                    t.innerText.toLowerCase().includes('warehouse') ||
                                    t.innerText.toLowerCase().includes('superstore')
                                ) || tables[0];
                                
                                if (stockTable) {
                                    const trs = Array.from(stockTable.querySelectorAll('tr'));
                                    const dataRows = trs.filter(r => r.querySelectorAll('td').length >= 2);
                                    if (dataRows.length > 0) {
                                        const hasQty = dataRows.some(r => r.querySelectorAll('td')[1].innerText.trim().length > 0);
                                        if (hasQty) {
                                            rows = trs.map(r => {
                                                const cells = Array.from(r.querySelectorAll('td, th'));
                                                if (cells.length >= 2) {
                                                    const warehouse = cells[0].innerText.trim();
                                                    const qtyText = cells[1].innerText.trim();
                                                    const qty = qtyText.replace(/[^\d]/g, '') || "0";
                                                    if (warehouse.toLowerCase() === 'warehouse' || warehouse.toLowerCase() === 'location') return null;
                                                    return { warehouse, qty };
                                                }
                                                return null;
                                            }).filter(Boolean);
                                            break;
                                        }
                                    }
                                }
                            }
                            await waitInternal(500);
                        }
                        return rows;
                    }).catch(async (err) => {
                        console.log(`⚠️ Flexible extraction failed: ${err.message}.`);
                        return [];
                    });

                    if (stockRows && stockRows.length > 0) {
                        console.log("📊 LIVE STOCK OVERVIEW (All Locations):");
                        stockRows.forEach(r => {
                            console.log(`   📍 ${r.warehouse}: ${r.qty}`);
                        });
                    } else {
                        console.log("⚠️ No stock data could be parsed from the popup table after waiting.");
                    }

                    // Find the "Packaging" row from our extracted data
                    const packagingRow = (stockRows || []).find(r => r.warehouse.toLowerCase().includes('packaging'));
                    const packagingQty = packagingRow ? (parseInt(packagingRow.qty, 10) || 0) : 0;
                    const requiredQty = (parseFloat(netQty) || 1);

                    console.log("-----------------------------------------");
                    console.log(`📦 PACKAGING STATUS: ${packagingQty} available | ${requiredQty} required`);
                    console.log("-----------------------------------------");

                    if (packagingQty >= requiredQty) {
                        console.log(`✅ Sufficient stock in Packaging (${packagingQty} >= ${requiredQty}).`);
                        stockSufficient = true;
                        
                        // ALWAYS ensure the Stock Location popup is closed via "Cancel" to clear the backdrop
                        console.log("❌ Ensuring Stock Location popup is closed (Cancel)...");
                        await inventoryTab.bringToFront();
                        const cancelBtnLoc = inventoryTab.locator('button:has-text("Cancel"), button.close, .modal-header .close, div.modal-footer button:has-text("Close")').filter({ visible: true }).first();
                        if (await cancelBtnLoc.count() > 0) {
                            await clickAndHighlight(inventoryTab, 'button:has-text("Cancel"), button.close, .modal-header .close, div.modal-footer button:has-text("Close")');
                            await wait(1500);
                        }
                    } else {
                        const deficit = requiredQty - packagingQty;
                        console.log(`⚠️ INSUFFICIENT STOCK IN PACKAGING! Deficit: ${deficit} (${requiredQty} - ${packagingQty}).`);

                        // Close Stock popup to perform transfer
                        console.log("❌ Closing Stock popup to perform transfer...");
                        await clickAndHighlight(inventoryTab, 'button:has-text("Cancel"), button.close, .modal-header .close').catch(() => null);
                        await wait(1000);

                        // Identify source warehouse with enough stock
                        const validSources = (stockRows || []).filter(r => 
                            !r.warehouse.toLowerCase().includes('packaging') && 
                            parseInt(r.qty, 10) >= deficit
                        );
                        let sourceWarehouseName = null;
                        if (validSources.length > 0) {
                            sourceWarehouseName = validSources[0].warehouse;
                            console.log(`🔍 Found Source Warehouse with sufficient stock: ${sourceWarehouseName} (${validSources[0].qty} available)`);
                        } else {
                            // If no single warehouse has enough, just find the one with the maximum stock as fallback
                            const anySource = (stockRows || []).filter(r => !r.warehouse.toLowerCase().includes('packaging')).sort((a,b) => parseInt(b.qty,10) - parseInt(a.qty,10));
                            if (anySource.length > 0) {
                                sourceWarehouseName = anySource[0].warehouse;
                                console.log(`⚠️ No single warehouse has enough stock. Attempting to use max stock warehouse: ${sourceWarehouseName} (${anySource[0].qty} available)`);
                            }
                        }

                        // Perform the transfer
                        await performStockTransfer(inventoryTab, requiredQty, deficit, productName, sourceWarehouseName);

                        // Re-search the product after transfer to refresh context and buttons
                        console.log(`⌨️ Re-searching for "${productName}" to refresh history...`);
                        await inventoryTab.goto("https://kart.farm:8443/Farmkart/inventoryList.jsp", { waitUntil: "domcontentloaded" });
                        await wait(2000);
                        const searchInput = inventoryTab.locator('input[type="search"], .dataTables_filter input, input[placeholder*="Search" i]').first();
                        await searchInput.fill(productName);
                        await clickAndHighlight(inventoryTab, 'button:has-text("Search"), i.fa-search');
                        await wait(2000);
                        await Promise.all([
                            inventoryTab.waitForNavigation({ waitUntil: "domcontentloaded" }),
                            clickAndHighlight(inventoryTab, 'a:has-text("History")')
                        ]);
                        await wait(2000); // Ensure History page is stable
                        console.log("🔄 Looping back to re-verify stock quantity...");
                    }
                }

                // ==========================================
                // PHASE 3: BARCODE EXTRACTION (VIA POPUP)
                // ==========================================
                console.log("🔍 Looking for 'PRINT HERE' for barcode extraction...");
                await inventoryTab.bringToFront();

                // Scroll to ensure the history table is rendered
                await inventoryTab.evaluate(() => window.scrollTo(0, 0)); // Scroll to top first to find first link
                await wait(1000);

                // Use a precise selector for the first "PRINT HERE" in the table
                // Usually it's an 'a' tag in a specific column
                const printBtnSelector = 'tbody tr td a:has-text("PRINT HERE")';
                const firstPrintBtn = inventoryTab.locator(printBtnSelector).first();

                if (await firstPrintBtn.count() === 0) {
                    console.log("❌ CRITICAL: Could not find any 'PRINT HERE' link. The process for this product will be bypassed.");
                    throw new Error("PRINT_BUTTON_MISSING");
                }

                console.log("👆 Clicking the FIRST 'PRINT HERE' link and waiting for popup...");
                let cleanBarcode = "";
                
                try {
                    // Start waiting for the popup before clicking
                    const [popup] = await Promise.all([
                        context.waitForEvent('page', { timeout: 15000 }),
                        firstPrintBtn.click({ force: true })
                    ]);

                    await popup.waitForLoadState("domcontentloaded");
                    const popupUrl = popup.url();
                    console.log(`🔗 Popup Opened: ${popupUrl}`);

                    // Strategy A: Extract from URL
                    const urlMatch = popupUrl.match(/barcode=\*?([^*&]+)\*?/);
                    if (urlMatch && urlMatch[1]) {
                        cleanBarcode = urlMatch[1].replace(/\*/g, '').replace(/\s/g, '').trim();
                    } else {
                        // Strategy B: Extract from Page Text
                        const bodyText = await popup.innerText('body').catch(() => "");
                        const textMatch = bodyText.match(/\*?\s*([\d\w-]+)\s*\*?/);
                        if (textMatch && textMatch[1]) {
                           cleanBarcode = textMatch[1].replace(/\*/g, '').replace(/\s/g, '').trim();
                        }
                    }

                    await popup.close().catch(() => null);
                } catch (err) {
                    console.log(`⚠️ Popup capture failed: ${err.message}. Checking existing pages...`);
                    
                    // Fallback: Check if the barcode page is already in open pages
                    const pages = context.pages();
                    let foundPage = null;
                    for (const p of pages) {
                        if (p.url().includes("barcode") || p.url().includes("barcodePrinter")) {
                            foundPage = p;
                            break;
                        }
                    }

                    if (foundPage) {
                        console.log(`🎯 Found existing barcode page: ${foundPage.url()}`);
                        const popupUrl = foundPage.url();
                        const urlMatch = popupUrl.match(/barcode=\*?([^*&]+)\*?/);
                        if (urlMatch && urlMatch[1]) {
                            cleanBarcode = urlMatch[1].replace(/\*/g, '').replace(/\s/g, '').trim();
                        } else {
                            const bodyText = await foundPage.innerText('body').catch(() => "");
                            const textMatch = bodyText.match(/\*?\s*([\d\w-]+)\s*\*?/);
                            if (textMatch && textMatch[1]) {
                               cleanBarcode = textMatch[1].replace(/\*/g, '').replace(/\s/g, '').trim();
                            }
                        }
                        await foundPage.close().catch(() => null);
                    } else {
                        console.log("⚠️ No existing barcode page found. Trying direct attribute extraction...");
                        const barcodeHref = await firstPrintBtn.getAttribute('href').catch(() => "");
                        const urlMatch = barcodeHref ? barcodeHref.match(/barcode=\*?([^*&]+)\*?/) : null;
                        if (urlMatch && urlMatch[1]) {
                            cleanBarcode = urlMatch[1].replace(/\*/g, '').replace(/\s/g, '').trim();
                        }
                    }
                }

                if (!cleanBarcode || cleanBarcode.length < 3) {
                    console.log("❌ Could not extract a valid barcode (too short or missing).");
                    throw new Error("BARCODE_EXTRACTION_FAILED");
                }

                console.log(`🏷️ Clean Barcode successfully grabbed: [${cleanBarcode}]`);

                // ==========================================
                // PHASE 4: VALIDATION & FORM ENTRY
                // ==========================================
                console.log("🔙 Returning to Invoice (Add Product Expiry) page...");
                await page.bringToFront();
                await wait(1000);

                console.log(`⌨️ Typing barcode [${cleanBarcode}] into 'Scan Barcode' for Product ${i}...`);
                await page.bringToFront();
                await wait(1500); // Wait for page to be ready after switch

                const barcodeSelectors = [
                    `#batchno_${i}_1`,
                    `input[name^="batchno_${i}"]`,
                    `input[placeholder*="Scan Barcode"]`,
                    `input[id*="batchno"]`
                ];

                let typed = false;
                for (const selector of barcodeSelectors) {
                    const input = page.locator(selector).first();
                    if (await input.count() > 0 && await input.isVisible()) {
                        await input.scrollIntoViewIfNeeded();
                        await input.fill(cleanBarcode);
                        await input.press('Enter');
                        await wait(2000); // 🕒 Wait for AJAX (Shelf, Expiry, Qty) to populate after barcode
                        typed = true;
                        break;
                    }
                }

                if (!typed) {
                    console.log("⚠️ Could not find barcode input with specific selectors. Trying first generic input in row...");
                    const genericInput = page.locator('input[type="text"]:not([readonly])').nth(i - 1);
                    await genericInput.fill(cleanBarcode);
                    await genericInput.press('Enter');
                }

                await wait(2000); // Wait for registration

                console.log("✅ Barcode scanned and verified.");
                // ==========================================
                // PHASE 5: SELECT BATCH & MATCH QTY
                // ==========================================
                console.log(`👆 Clicking 'Verify' button for Product ${i}...`);
                await page.bringToFront();

                const specificVerifyLoc = page.locator(`span[onclick*="verifyButton('${i}_1')"], span[onclick*="verifyButton('${i}_"], span#verify_${i}_1, button#verify_${i}_1`).filter({ visible: true });
                
                if (await specificVerifyLoc.count() > 0) {
                    console.log("👆 Found row-specific 'Verify' button. Clicking...");
                    await specificVerifyLoc.first().click();
                } else {
                    console.log(`⚠️ Specific Verify button not found for product ${i}, attempting generic...`);
                    const genericVerifyBtns = page.locator('span.btn-warning:has-text("Verify"), button.btn-warning:has-text("Verify"), a.btn-warning:has-text("Verify")').filter({ visible: true });
                    if (await genericVerifyBtns.count() >= i) {
                        console.log(`👆 Clicking the ${i}-th generic Verify button...`);
                        await genericVerifyBtns.nth(i - 1).click();
                    } else if (await genericVerifyBtns.count() > 0) {
                        console.log("❌ Not enough visible Verify buttons found, clicking the last available one...");
                        await genericVerifyBtns.last().click();
                    } else {
                        console.log("❌ Could not find ANY visible Verify button!");
                    }
                }

                console.log("🕒 Waiting for AJAX content (Expiry, Shelf, Qty) to populate...");
                const expirySelectLoc = page.locator(`#expiry_${i}_1, select[name^="expiry_${i}"]`).filter({ visible: true }).first();
                
                // Dynamically wait for the dropdown to actually receive options from AJAX
                let ajaxPopulated = false;
                for (let k = 0; k < 12; k++) { // wait up to 12 seconds
                    if (await expirySelectLoc.count() > 0) {
                        const optCount = await expirySelectLoc.locator('option').count().catch(() => 0);
                        if (optCount > 1) {
                            ajaxPopulated = true;
                            break;
                        }
                    }
                    await wait(1000);
                }

                if (!ajaxPopulated) {
                    console.log("⚠️ Expiry options did NOT populate after 12s. Moving forward, but this might fail!");
                } else {
                    console.log("✅ AJAX populated the dropdowns successfully.");
                }

                console.log("📝 Looking for Expiry and Shelf Code dropdowns...");

                if (await expirySelectLoc.count() > 0) {
                    console.log(`👆 Selecting first available Expiry batch for Product ${i}...`);
                    await expirySelectLoc.selectOption({ index: 1 }).catch(() => null);
                    await wait(1000); // Wait for subsequent AJAX chains
                }

                // Select the first valid Shelf Code (index 1)
                const shelfCodeSelectLoc = page.locator(`#shelfCode_${i}_1, select[name^="shelfCode_${i}"]`).filter({ visible: true }).first();
                if (await shelfCodeSelectLoc.count() > 0) {
                    console.log(`👆 Selecting first available Shelf Code for Product ${i}...`);
                    await shelfCodeSelectLoc.selectOption({ index: 1 }).catch(() => null);
                    await wait(500);
                }

                console.log(`⌨️ Matching Qty Dropdown to Net Qty (${netQty})...`);

                // Look for the quantity dropdown
                const qtySelectLoc = page.locator(`select#qty_${i}_1, select[name^="qty_${i}"]`).filter({ visible: true }).first();
                const qtyInputLoc = page.locator(`input#qty_${i}_1, input[name^="qty_${i}"], input[name="qty"], input[name="strQty"]`).filter({ visible: true }).first();

                if (await qtySelectLoc.count() > 0) {
                    // Try strictly selecting the value equal to netQty, handling 1.0 vs 1
                    try {
                        const targetQtyStr = String(netQty);
                        const targetQtyIntStr = String(Math.floor(netQty));

                        // Try exact label or numeric integer label
                        await qtySelectLoc.selectOption({ label: targetQtyStr }).catch(async () => {
                            await qtySelectLoc.selectOption({ label: targetQtyIntStr }).catch(async () => {
                                // Try values
                                await qtySelectLoc.selectOption({ value: targetQtyStr }).catch(async () => {
                                    await qtySelectLoc.selectOption({ value: targetQtyIntStr });
                                });
                            });
                        });
                        console.log(`✅ Selected Qty Option: ${netQty}`);
                    } catch (e) {
                        console.log(`⚠️ Match for Qty '${netQty}' not found in Dropdown. Picking first available...`);
                        await qtySelectLoc.selectOption({ index: 1 }).catch(() => null);
                    }
                } else if (await qtyInputLoc.count() > 0) {
                    // Sometimes it's a text input
                    await qtyInputLoc.fill(String(netQty));
                    console.log(`✅ Filled Text Qty: ${netQty}`);
                } else {
                    console.log("⚠️ Could not find any Qty Dropdown or Input to match.");
                }

                console.log(`✅ Product ${i} processing completed.`);
            } // END OF PRODUCT LOOP

            console.log(`✅ All ${productCount} product(s) processed for this invoice.`);

            console.log("👆 Clicking final 'Generate Invoice' button...");
            await page.bringToFront();
            const generateBtnSelector = 'button[type="submit"]:has-text("Generate Invoice"), button.btn-primary:has-text("Generate Invoice")';
            await Promise.all([
                page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => null),
                clickAndHighlight(page, generateBtnSelector)
            ]);

            console.log("✅ Invoice Generated Successfully!");
            await recordAction("generate_invoice", generateBtnSelector, "Generate Invoice");
            processed++;

            // UPDATE GOOGLE SHEET STATUS
            if (o.sheetRow) {
                console.log(`📡 Updating Google Sheet status for Row ${o.sheetRow}...`);
                await updateInvoiceStatus(o.sheetRow);
            }

            // Wait briefly before safely closing the invoice tab to prep for the next order
            await wait(2000);
            console.log("🧹 Closed Invoice tab for safety.");

        } catch (error) {
            console.error(`❌ AI Error Diagnostics for Order ${o.orderId}:`, error.message);
            
            if (retryCount < maxRetries) {
                console.log(`🤖 AI Recovery Attempt ${retryCount + 1}... Examining page for blockers.`);
                const recovered = await attemptSelfHealing(page, "general_recovery");
                if (recovered) {
                    console.log("✅ AI healed the page! Retrying the process...");
                    retryCount++;
                    continue;
                }
            }
            
            console.error(`❌ Final failure for order ${o.orderId}. Moving to next.`);
            break; // Exit retry loop and move to next order
        }
        break; // Success! Exit retry loop
        }
    }

    console.log("\n🎉 Invoice generation automation finished.");

    // Hold browser open if not auto
    if (startRowIdx === -1) {
        const rlFinal = readline.createInterface({ input: process.stdin, output: process.stdout });
        await new Promise(resolve => rlFinal.question("👉 Press ENTER to close browser...", resolve));
        rlFinal.close();
    } else if (processed > 0) {
        // Run from website (auto mode) and we actually did something - hold for 15 seconds to let the user see it
        console.log("⏱️ Holding browser open for 15 seconds to let you review...");
        await wait(15000);
    } else {
        console.log("⏭️ No orders were processed. Closing browser immediately.");
    }

    await browser.close();
    console.log("🧹 Browser closed.");
})();
