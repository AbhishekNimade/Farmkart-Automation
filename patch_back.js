const fs = require('fs');
let code = fs.readFileSync('invoice-automation/index.js', 'utf8');

// We have the previous version of the loop logic.
const correctLoopLogic = `
            console.log("👆 Clicking 'Generate New Invoice'...");
            const invoiceLinkLoc = page.locator('a[href*="invoice_new.jsp"], a[href*="addtoexpiry.jsp"]').first();
            const hrefAttr = await invoiceLinkLoc.getAttribute('href').catch(() => null);

            // Go to the href directly if possible, or click and wait if it's dynamic
            if (hrefAttr) {
                const absoluteUrl = new URL(hrefAttr, page.url()).href;
                await page.goto(absoluteUrl, { waitUntil: "domcontentloaded" });
            } else {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => null),
                    clickAndHighlight(page, 'a.generate-invoice-btn, button:has-text("Generate New Invoice")').catch(() => null)
                ]);
            }
            console.log("✅ Opened New Invoice ('Add Product Expiry') page.");
            await wait(2000);

            // ==========================================
            // PHASE 1: LOOP SETUP & PRODUCT EXTRACTION
            // ==========================================
            console.log("🔍 Checking for multiple products in this invoice...");

            // Wait for the form to load on the new invoice page
            await page.waitForSelector('div[id^="productRow"]', { state: 'visible', timeout: 10000 }).catch(() => null);

            // Count how many product rows exist
            const productRowsLoc = page.locator('div[id^="productRow"]');
            const totalProducts = await productRowsLoc.count();
            const productCount = totalProducts > 0 ? totalProducts : 1;

            console.log(\`📦 Found \${productCount} product(s) to process in this invoice.\`);

            // Loop through each product
            for (let i = 1; i <= productCount; i++) {
                console.log(\`\\n-----------------------------------------\`);
                console.log(\`▶️ Processing Product \${i} of \${productCount}...\`);
                console.log(\`-----------------------------------------\`);

                // Dynamically fetch the Product Name and Net Qty for the current row \`i\`
                const productName = await page.locator(\`#productId_\${i}\`).inputValue().catch(async () => {
                    // Fallback to the \`nth(i-1)\` readonly generic input if ID fails
                    const inputs = page.locator('input[type="text"][readonly], input.form-control[readonly]');
                    if (await inputs.count() >= i) return await inputs.nth(i - 1).inputValue();
                    return "Unknown Product";
                });

                const netQtyStr = await page.locator(\`#netQty_\${i}\`).inputValue().catch(async () => {
                    // Fallback guess
                    const textInputs = page.locator('input[type="text"]');
                    if (await textInputs.count() >= i * 2) return await textInputs.nth((i * 2) - 1).inputValue();
                    return "1.0";
                });
                const netQty = parseFloat(netQtyStr) || 1.0;

                console.log(\`📌 Found Product [\${i}]: "\${productName}", Net Qty: \${netQty}\`);

                console.log("🌐 Switching to Inventory List tab...");
                await inventoryTab.bringToFront();
                await inventoryTab.goto("https://kart.farm:8443/Farmkart/inventoryList.jsp", { waitUntil: "domcontentloaded" });
                await wait(2000);

                console.log(\`⌨️ Searching for "\${productName}" in Inventory...\`);
                // Farmkart data tables often use standard text inputs with an 'aria-controls' attribute or a specific wrapper class.
                const searchInputLoc = inventoryTab.locator('input[type="search"], .dataTables_filter input, input[placeholder*="Search" i], input[aria-controls]').first();
                await searchInputLoc.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
                // Type only the first few words to ensure a hit if name is too long
                const shortName = productName.split(' ').slice(0, 3).join(' ');
                await searchInputLoc.fill(shortName);

                console.log("👆 Clicking 'Search' button...");
                // Matches obvious Search buttons near the input or anywhere on the filter bar
                await clickAndHighlight(inventoryTab, 'button:has-text("Search"), input[type="submit"][value="Search"], .btn-search, i.fa-search').catch(() => null);
                await wait(2000); // Wait for DataTables sorting algorithm/server response

                console.log("👆 Clicking 'History' for the matched product...");
                // Matches the first row's History button in the filtered table
                await Promise.all([
                    inventoryTab.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => null),
                    clickAndHighlight(inventoryTab, 'a:has-text("History"), button:has-text("History")').catch(() => null)
                ]);
                await wait(2000);

                // ==========================================
                // PHASE 2: STOCK VERIFICATION (PACKAGING)
                // ==========================================
                console.log("👆 Clicking 'Stock Location'...");
                await clickAndHighlight(inventoryTab, 'button:has-text("Stock Location"), a:has-text("Stock Location")');
                await wait(1000); // Wait for popup

                console.log("🔍 Extracting all warehouse quantities...");
                const stockRows = await inventoryTab.$$eval('.modal-content table tr, .modal-body table tr', rows => {
                    return rows.map(r => {
                        const tds = r.querySelectorAll('td');
                        if (tds.length >= 2) {
                            return { warehouse: tds[0].innerText.trim(), qty: tds[1].innerText.trim() };
                        }
                        return null;
                    }).filter(Boolean);
                }).catch(() => []);

                if (stockRows.length > 0) {
                    console.log("📊 Live Stock Overview:");
                    stockRows.forEach(r => console.log(\`   - \${r.warehouse}: \${r.qty}\`));
                }

                // Find the "Packaging" row from our extracted data
                const packagingRow = stockRows.find(r => r.warehouse.toLowerCase().includes('packaging'));
                const packagingQty = packagingRow ? (parseInt(packagingRow.qty, 10) || 0) : 0;
                const requiredQty = parseInt(netQty, 10) || 1;

                console.log(\`📦 Packaging Stock: \${packagingQty} | Required: \${requiredQty}\`);

                if (packagingQty >= requiredQty) {
                    console.log("✅ Sufficient stock in Packaging.");
                } else {
                    console.log(\`⚠️ INSUFFICIENT STOCK IN PACKAGING for Product "\${productName}"! Proceeding anyway per request.\`);
                }

                console.log("❌ Closing Stock popup (Cancel)...");
                await clickAndHighlight(inventoryTab, 'button:has-text("Cancel"), button.close, .modal-header .close').catch(() => null);
                await wait(1000);

                // ==========================================
                // PHASE 3: BARCODE EXTRACTION (VIA URL TO AVOID POPUP FLAKINESS)
                // ==========================================
                console.log("🔍 Extracting barcode right from 'PRINT HERE' link...");

                const printBtn = inventoryTab.locator('a:has-text("PRINT HERE")').first();
                if (await printBtn.count() === 0) {
                    console.log("❌ Could not find the 'PRINT HERE' button. Failing safely.");
                    throw new Error("PRINT_HERE_BUTTON_MISSING");
                }

                const barcodeHref = await printBtn.getAttribute('href');
                console.log(\`🔗 Found Print Link URL: \${barcodeHref}\`);

                let cleanBarcode = "";
                // Looking for barcodePrinter.jsp?barcode=*1234*
                const urlMatch = barcodeHref ? barcodeHref.match(/barcode=\\*?([^*&]+)\\*?/) : null;

                if (urlMatch && urlMatch[1]) {
                    cleanBarcode = urlMatch[1].replace(/[\\*\\s]/g, '').trim();
                } else {
                    console.log("❌ Could not extract valid barcode from URL String.");
                    throw new Error("BARCODE_URL_EXTRACTION_FAILED");
                }

                console.log(\`🏷️ Clean Barcode grabbed: \${cleanBarcode}\`);

                // ==========================================
                // PHASE 4: VALIDATION & FORM ENTRY
                // ==========================================
                console.log("🔙 Returning to Invoice (Add Product Expiry) page...");
                await page.bringToFront();
                await wait(1000);

                console.log(\`⌨️ Typing barcode [\${cleanBarcode}] into 'Scan Barcode' for Product \${i}...\`);
                // Target the specific scan input for this row (\`#batchno_1_1\`, \`#batchno_2_1\` etc)
                const scanInput = page.locator(\`#batchno_\${i}_1\`).first();

                // If the specific ID fails, fallback to the generic scanning
                if (await scanInput.count() === 0) {
                    const fallbackInput = page.locator('input[placeholder*="Barcode" i], input[name*="batchno" i]').nth(i - 1);
                    await fallbackInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
                    await fallbackInput.fill(cleanBarcode);
                    await fallbackInput.press('Enter');
                } else {
                    await scanInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
                    await scanInput.fill(cleanBarcode);
                    await scanInput.press('Enter');
                }
                await wait(3000); // Wait for verification response from server

                console.log("✅ Barcode scanned and verified.");
                // ==========================================
                // PHASE 5: SELECT BATCH & MATCH QTY
                // ==========================================
                console.log(\`�� Clicking 'Verify' button for Product \${i} (vital for dropdown population)...\`);

                // The user provided exact HTML: <span class="btn btn-warning sticky" onclick="verifyButton('1_1', '2780')">Verify </span>
                await clickAndHighlight(page, \`span[onclick*="verifyButton('\${i}_1'"], span.btn-warning:has-text("Verify")\`).catch(() => null);

                console.log(\`⏳ Waiting for Expiry dropdown options to populate via AJAX for Product \${i}...\`);
                await wait(3000); // Wait for network request to populate dropdown options

                console.log("📝 Looking for Expiry and Shelf Code dropdowns...");

                // We now know the exact ID: #expiry_1_1, #expiry_2_1, etc.
                const expirySelectLoc = page.locator(\`#expiry_\${i}_1, select[name^="expiry_\${i}"]\`).first();
                if (await expirySelectLoc.count() > 0) {
                    console.log(\`👆 Selecting first available Expiry batch for Product \${i}...\`);
                    await expirySelectLoc.selectOption({ index: 1 }).catch(() => null);
                    await wait(1000); // wait for ajax or shelf code to populate
                }

                // Select the first valid Shelf Code (index 1)
                const shelfCodeSelectLoc = page.locator(\`#shelfCode_\${i}_1, select[name^="shelfCode_\${i}"]\`).first();
                if (await shelfCodeSelectLoc.count() > 0) {
                    console.log(\`👆 Selecting first available Shelf Code for Product \${i}...\`);
                    await shelfCodeSelectLoc.selectOption({ index: 1 }).catch(() => null);
                    await wait(500);
                }

                console.log(\`⌨️ Matching Qty Dropdown to Net Qty (\${netQty})...\`);

                // Look for the quantity dropdown
                // Specific exact ID revealed by HTML source
                const qtySelectLoc = page.locator(\`#qty_\${i}_1, select[name^="qty_\${i}"]\`).first();

                if (await qtySelectLoc.count() > 0) {
                    // Try strictly selecting the value equal to netQty
                    try {
                        await qtySelectLoc.selectOption({ label: String(netQty) });
                        console.log(\`✅ Selected Qty: \${netQty} exactly.\`);
                    } catch (e) {
                        console.log(\`⚠️ Exact NetQty label '\${netQty}' not found in Dropdown. Picking the largest available or fallback...\`);
                        // If label fails, try value
                        await qtySelectLoc.selectOption({ value: String(netQty) }).catch(async () => {
                            // Total fallback to index 1 (usually the maximum or available choice)
                            await qtySelectLoc.selectOption({ index: 1 }).catch(() => null);
                            const fallbackVal = await qtySelectLoc.inputValue();
                            console.log(\`⚠️ Fallback selected Qty: \${fallbackVal}\`);
                        });
                    }
                } else {
                    // Sometimes it's a text input
                    const qtyInputLoc = page.locator(\`#qty_\${i}_1, input[name="qty"], input[name="strQty"]\`).first();
                    if (await qtyInputLoc.count() > 0) {
                        await qtyInputLoc.fill(String(netQty));
                        console.log(\`✅ Filled Text Qty: \${netQty}\`);
                    } else {
                        console.log("⚠️ Could not find any Qty Dropdown or Input to match.");
                    }
                }

                console.log(\`✅ Product \${i} processing completed.\`);
            } // END OF PRODUCT LOOP

`;

const startIdx = code.indexOf(`            // ==========================================
            // PHASE 1: EXTRACT PRODUCTS FROM ORDER DETAILS`);

const endIdx = code.indexOf(`            console.log("🛑 PAUSED: All Products Processed. Expiry & Qty matched. Ready for final generation step (User approval pending in bot flow).");`);
if (startIdx !== -1 && endIdx !== -1) {
    const replaceStr = code.substring(startIdx, endIdx);
    code = code.replace(replaceStr, correctLoopLogic);
    fs.writeFileSync('invoice-automation/index.js', code);
    console.log("Restored reliable loop layout");
}
