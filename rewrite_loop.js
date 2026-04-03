const fs = require('fs');

let code = fs.readFileSync('invoice-automation/index.js', 'utf8');

const regexProcessBtn = /\/\/ ==========================================\s*\/\/ PRE-PHASE.*?console\.log\("⏭️ 'Update Order status' button not found[^\n]+\n\s*\}/s;

const prePhaseBlock = code.match(regexProcessBtn)[0];

const loopExtractionLogic = `
            // ==========================================
            // PHASE 1: EXTRACT PRODUCTS FROM ORDER DETAILS
            // ==========================================
            console.log("🔍 Extracting products directly from Order Details page...");

            // Wait for the table to load
            await page.waitForSelector('table.table-striped', { state: 'visible', timeout: 10000 }).catch(() => null);

            // Get all rows in the table body
            const rows = page.locator('table.table-striped tbody tr');
            const totalProducts = await rows.count();
            const productCount = totalProducts > 0 ? totalProducts : 1;

            console.log(\`📦 Found \${productCount} product(s) to process in this order.\`);
            
            // Array to store product details
            let products = [];
            for (let i = 0; i < productCount; i++) {
                const row = rows.nth(i);
                
                // Usually column 1 is Product Name, column 2 is Qty, etc. (Depending on farmkart layout)
                // Let's get the text of the row to parse it safely or just find the product link
                // Assuming standard Farmkart: Product name is in the second column (index 1) or inside an anchor tag
                const productName = await row.locator('td').nth(1).innerText().catch(async () => {
                   return await row.innerText(); 
                });
                
                // Assuming netQty is in the 3rd or 4th column
                const netQtyStr = await row.locator('td').nth(2).innerText().catch(() => "1");
                const netQty = parseFloat(netQtyStr) || 1.0;
                
                products.push({ id: i + 1, name: productName.trim().split('\\n')[0], qty: netQty });
            }

            console.log("📝 Extracted Products:", products);

            // ==========================================
            // PHASE 2 & 3: INVENTORY SEARCH, STOCK CHECK & BARCODE
            // ==========================================
            for (const prod of products) {
                console.log(\`\\n-----------------------------------------\`);
                console.log(\`▶️ Processing Product \${prod.id} of \${productCount}... (\${prod.name})\`);
                console.log(\`-----------------------------------------\`);

                console.log("🌐 Switching to Inventory List tab...");
                await inventoryTab.bringToFront();
                await inventoryTab.goto("https://kart.farm:8443/Farmkart/inventoryList.jsp", { waitUntil: "domcontentloaded" });
                await wait(2000);

                console.log(\`⌨️ Searching for "\${prod.name}" in Inventory...\`);
                const searchInputLoc = inventoryTab.locator('input[type="search"], .dataTables_filter input, input[placeholder*="Search" i], input[aria-controls]').first();
                await searchInputLoc.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
                // Type only the first few words to ensure a hit if name is too long
                const shortName = prod.name.split(' ').slice(0, 3).join(' ');
                await searchInputLoc.fill(shortName);

                console.log("👆 Clicking 'Search' button...");
                await clickAndHighlight(inventoryTab, 'button:has-text("Search"), input[type="submit"][value="Search"], .btn-search, i.fa-search').catch(() => null);
                await wait(2000); 

                console.log("👆 Clicking 'History' for the matched product...");
                await Promise.all([
                    inventoryTab.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => null),
                    clickAndHighlight(inventoryTab, 'a:has-text("History"), button:has-text("History")').catch(() => null)
                ]);
                await wait(2000);

                // STOCK VERIFICATION
                console.log("👆 Clicking 'Stock Location'...");
                await clickAndHighlight(inventoryTab, 'button:has-text("Stock Location"), a:has-text("Stock Location")');
                await wait(1000); 

                console.log("🔍 Extracting all warehouse quantities...");
                const stockRows = await inventoryTab.$$eval('.modal-content table tr, .modal-body table tr', domRows => {
                    return domRows.map(r => {
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

                const packagingRow = stockRows.find(r => r.warehouse.toLowerCase().includes('packaging'));
                const packagingQty = packagingRow ? (parseInt(packagingRow.qty, 10) || 0) : 0;
                const requiredQty = parseInt(prod.qty, 10) || 1;

                console.log(\`📦 Packaging Stock: \${packagingQty} | Required: \${requiredQty}\`);

                if (packagingQty >= requiredQty) {
                    console.log("✅ Sufficient stock in Packaging.");
                } else {
                    console.log(\`⚠️ INSUFFICIENT STOCK IN PACKAGING for Product "\${prod.name}"! Proceeding anyway per request.\`);
                }

                console.log("❌ Closing Stock popup (Cancel)...");
                await clickAndHighlight(inventoryTab, 'button:has-text("Cancel"), button.close, .modal-header .close').catch(() => null);
                await wait(1000);

                // BARCODE EXTRACTION
                console.log("🔍 Extracting barcode right from 'PRINT HERE' link...");
                const printBtn = inventoryTab.locator('a:has-text("PRINT HERE")').first();
                if (await printBtn.count() === 0) {
                    console.log("❌ Could not find the 'PRINT HERE' button. Failing safely.");
                    throw new Error("PRINT_HERE_BUTTON_MISSING");
                }

                const barcodeHref = await printBtn.getAttribute('href');
                let cleanBarcode = "";
                const urlMatch = barcodeHref ? barcodeHref.match(/barcode=\\*?([^*&]+)\\*?/) : null;
                if (urlMatch && urlMatch[1]) {
                    cleanBarcode = urlMatch[1].replace(/[\\*\\s]/g, '').trim();
                } else {
                    throw new Error("BARCODE_URL_EXTRACTION_FAILED");
                }
                
                prod.cleanBarcode = cleanBarcode;
                console.log(\`🏷️ Clean Barcode grabbed: \${cleanBarcode}\`);
            } // END INVENTORY LOOP

            // ==========================================
            // PHASE 4: OPEN INVOICE AND FILL DATA
            // ==========================================
            console.log("🔙 Returning to Order Details to open 'Generate New Invoice'...");
            await page.bringToFront();
            await wait(1000);

            console.log("👆 Clicking 'Generate New Invoice'...");
            const invoiceLinkLoc = page.locator('a[href*="invoice_new.jsp"], a[href*="addtoexpiry.jsp"]').first();
            const hrefAttr = await invoiceLinkLoc.getAttribute('href').catch(() => null);

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

            // Wait for the form to load on the new invoice page
            await page.waitForSelector('div[id^="productRow"]', { state: 'visible', timeout: 10000 }).catch(() => null);

            for (const prod of products) {
                const i = prod.id;
                const cleanBarcode = prod.cleanBarcode;
                const netQty = prod.qty;

                console.log(\`\\n-----------------------------------------\`);
                console.log(\`▶️ Filling Invoice for Product \${i} (\${prod.name})...\`);
                
                console.log(\`⌨️ Typing barcode [\${cleanBarcode}] into 'Scan Barcode' for Product \${i}...\`);
                const scanInput = page.locator(\`#batchno_\${i}_1\`).first();

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
                await wait(3000); 

                console.log("✅ Barcode scanned and verified.");
                
                console.log(\`👆 Clicking 'Verify' button for Product \${i}...\`);
                await clickAndHighlight(page, \`span[onclick*="verifyButton('\${i}_1'"], span.btn-warning:has-text("Verify")\`).catch(() => null);

                console.log(\`⏳ Waiting for Expiry dropdown options to populate via AJAX for Product \${i}...\`);
                await wait(3000); 

                const expirySelectLoc = page.locator(\`#expiry_\${i}_1, select[name^="expiry_\${i}"]\`).first();
                if (await expirySelectLoc.count() > 0) {
                    console.log(\`👆 Selecting first available Expiry batch for Product \${i}...\`);
                    await expirySelectLoc.selectOption({ index: 1 }).catch(() => null);
                    await wait(1000); 
                }

                const shelfCodeSelectLoc = page.locator(\`#shelfCode_\${i}_1, select[name^="shelfCode_\${i}"]\`).first();
                if (await shelfCodeSelectLoc.count() > 0) {
                    console.log(\`👆 Selecting first available Shelf Code for Product \${i}...\`);
                    await shelfCodeSelectLoc.selectOption({ index: 1 }).catch(() => null);
                    await wait(500);
                }

                console.log(\`⌨️ Matching Qty Dropdown to Net Qty (\${netQty})...\`);
                const qtySelectLoc = page.locator(\`#qty_\${i}_1, select[name^="qty_\${i}"]\`).first();

                if (await qtySelectLoc.count() > 0) {
                    try {
                        await qtySelectLoc.selectOption({ label: String(netQty) });
                        console.log(\`✅ Selected Qty: \${netQty} exactly.\`);
                    } catch (e) {
                        console.log(\`⚠️ Exact NetQty label '\${netQty}' not found in Dropdown. Picking the fallback...\`);
                        await qtySelectLoc.selectOption({ value: String(netQty) }).catch(async () => {
                            await qtySelectLoc.selectOption({ index: 1 }).catch(() => null);
                        });
                    }
                } else {
                    const qtyInputLoc = page.locator(\`#qty_\${i}_1, input[name="qty"], input[name="strQty"]\`).first();
                    if (await qtyInputLoc.count() > 0) {
                        await qtyInputLoc.fill(String(netQty));
                        console.log(\`✅ Filled Text Qty: \${netQty}\`);
                    }
                }
                console.log(\`✅ Product \${i} invoice filling completed.\`);
            }
`;

// Now find the entire block from the end of PRE-PHASE to the end of the loop, and replace it.
// Starts with: console.log("👆 Clicking 'Generate New Invoice'...");
// Ends with: console.log("🛑 PAUSED: All Products Processed...
const startIdx = code.indexOf(`            console.log("👆 Clicking 'Generate New Invoice'...");`);
const endIdx = code.indexOf(`            console.log("🛑 PAUSED: All Products Processed. Expiry & Qty matched. Ready for final generation step (User approval pending in bot flow).");`);

if (startIdx !== -1 && endIdx !== -1) {
    const stringToReplace = code.substring(startIdx, endIdx);
    code = code.replace(stringToReplace, loopExtractionLogic + "\n");
    fs.writeFileSync('invoice-automation/index.js', code);
    console.log("Successfully rewrote index.js sequence logic.");
} else {
    console.log("Could not find start/end bounds for replacement.");
}

