const fs = require('fs');
const file = "invoice-automation/index.js";
let content = fs.readFileSync(file, 'utf8');

// The replacement content
const newContent = `
            // Give the UI a moment to stabilize
            await wait(2000);

            console.log("👆 Clicking 'Generate New Invoice'...");
            await Promise.all([
                page.waitForNavigation({ waitUntil: "domcontentloaded" }), // Clicking this link will load the invoice generation page
                page.click('a[href*="invoice_new.jsp"]')
            ]);
            console.log("✅ Opened New Invoice ('Add Product Expiry') page.");
            await wait(2000);

            // ==========================================
            // PHASE 1: EXTRACT INFO & INVENTORY CHECK
            // ==========================================
            console.log("🔍 Extracting Product Name and Net Qty...");
            
            const productName = await page.locator('text="Farmkart Product"').locator('..').locator('input').first().inputValue().catch(async () => {
                const inputs = page.locator('input[type="text"][readonly], input.form-control[readonly]');
                if (await inputs.count() > 0) return await inputs.first().inputValue();
                return "Unknown Product";
            });

            const netQtyStr = await page.locator('text="Net Qty"').locator('..').locator('input').first().inputValue().catch(async () => {
                 const textInputs = page.locator('input[type="text"]');
                 if (await textInputs.count() >= 2) return await textInputs.nth(1).inputValue(); 
                 return "1.0";
            });
            const netQty = parseFloat(netQtyStr) || 1.0;

            console.log(\`📌 Found Product: "\${productName}", Net Qty: \${netQty}\`);

            console.log("🌐 Opening Inventory List in a NEW tab...");
            const inventoryPageUrl = "https://kart.farm:8443/Farmkart/inventoryList.jsp";
            
            const inventoryContext = page.context();
            const inventoryTab = await inventoryContext.newPage();
            
            await inventoryTab.goto(inventoryPageUrl, { waitUntil: "domcontentloaded" });
            await wait(2000);

            console.log(\`⌨️ Searching for "\${productName}" in Inventory...\`);
            await inventoryTab.fill('input[type="search"]', productName.trim());
            await wait(1500); // Table filtering delay

            console.log("👆 Clicking 'History' for the matched product...");
            await Promise.all([
                inventoryTab.waitForNavigation({ waitUntil: "domcontentloaded" }),
                inventoryTab.click('a.btn-info:has-text("History")') 
            ]);
            await wait(2000);

            // ==========================================
            // PHASE 2: STOCK VERIFICATION (PACKAGING)
            // ==========================================
            console.log("👆 Clicking 'Stock Location'...");
            await inventoryTab.click('button:has-text("Stock Location"), a:has-text("Stock Location")');
            await wait(1000); // Wait for popup

            console.log("🔍 Extracting 'Packaging' quantity...");
            const packagingQtyText = await inventoryTab.$eval('tr:has(td:has-text("Packaging")) td:nth-child(2)', el => el.innerText).catch(() => "0");
            const packagingQty = parseInt(packagingQtyText.trim(), 10) || 0;
            const requiredQty = parseInt(netQty, 10) || 1;

            console.log(\`📦 Packaging Stock: \${packagingQty} | Required: \${requiredQty}\`);

            if (packagingQty >= requiredQty) {
                console.log("✅ Sufficient stock in Packaging! Closing popup...");
                await inventoryTab.click('button:has-text("Cancel")');
                await wait(1000);
            } else {
                console.log("⚠️ INSUFFICIENT STOCK IN PACKAGING! (Entering 'Else' condition - needs implementation)");
                await inventoryTab.close();
                throw new Error("INSUFFICIENT_STOCK_IN_PACKAGING");
            }

            // ==========================================
            // PHASE 3: BARCODE EXTRACTION
            // ==========================================
            console.log("👆 Clicking 'PRINT HERE' to grab barcode...");
            
            const [popup] = await Promise.all([
                inventoryTab.waitForEvent('popup'),
                inventoryTab.click('a:has-text("PRINT HERE")')
            ]);
            
            await popup.waitForLoadState();
            await wait(1000);

            console.log("🔍 Extracting barcode text...");
            const rawBarcode = await popup.$eval('body', el => el.innerText);
            
            const cleanBarcodeMatch = rawBarcode.match(/\\*(.*?)\\*/); 
            let cleanBarcode = "";
            if (cleanBarcodeMatch && cleanBarcodeMatch[1]) {
                cleanBarcode = cleanBarcodeMatch[1].trim();
            } else {
                cleanBarcode = rawBarcode.replace(/\\*/g, '').replace(/\\n/g, '').trim();
            }

            console.log(\`🏷️ Clean Barcode grabbed: \${cleanBarcode}\`);
            
            console.log("❌ Closing barcode popup and Inventory tab...");
            await popup.close();
            await inventoryTab.close();
            
            // ==========================================
            // PHASE 4: VALIDATION & FORM ENTRY
            // ==========================================
            console.log("🔙 Returning to Invoice (Add Product Expiry) page...");
            await page.bringToFront();
            await wait(1500);

            console.log("⌨️ Filling Batch No (Scan Barcode)...");
            await page.locator('text="Batch No."').locator('..').locator('input[type="text"], input[type="number"]').first().fill(cleanBarcode).catch(async () => {
                 await page.fill('input[placeholder="Scan Barcode"]', cleanBarcode);
            });
            await wait(500);

            console.log("👆 Clicking 'Verify'...");
            await page.click('button:has-text("Verify")');
            
            console.log("⏳ Waiting for Verify popup result...");
            await wait(1500);
            
            const greenToastVisible = await page.isVisible('.toast-success, div[style*="background-color: rgb(81, 163, 81)"], div.alert-success, div:has-text("Bacth No. Found!")'); 
            const redToastVisible = await page.isVisible('.toast-error, div[style*="background-color: rgb(189, 54, 47)"], div.alert-danger, div:has-text("Invalid Batch No!")');

            if (redToastVisible && !greenToastVisible) {
                console.log("❌ Barcode Verify FAILED (Red Popup)! (Retry logic needs implementation)");
                throw new Error("INVALID_BATCH_NO");
            } else {
                console.log("✅ Barcode Verify SUCCESS (Green Popup)!");
            }

            console.log("📝 Selecting Expiry and Shelf Code...");
            await page.locator('text="Expiry"').locator('..').locator('select').selectOption({ index: 1 }).catch(() => {});
            await page.locator('text="Shelf Code"').locator('..').locator('select').selectOption({ index: 1 }).catch(() => {});

            console.log("⌨️ Entering final Qty matching Net Qty...");
            const qtyInputLoc = page.locator('text="Qty"').locator('..').locator('input[type="text"], input[type="number"]');
            if (await qtyInputLoc.count() > 0) {
                 await qtyInputLoc.first().fill(netQtyStr);
            } else {
                 const qtySelectLoc = page.locator('text="Qty"').locator('..').locator('select');
                 if (await qtySelectLoc.count() > 0) {
                     await qtySelectLoc.selectOption({ label: netQtyStr }).catch(async () => {
                          await qtySelectLoc.selectOption({ index: 1 });
                     });
                 }
            }
            
            console.log("�� PAUSED: Form filled. Ready to generate invoice, but waiting for User permission to proceed.");
            
            processed++;
`;

const startIndex = content.indexOf('// Give the UI a moment to stabilize');
const endIndexStr = 'processed++;';
const endIndex = content.indexOf(endIndexStr, startIndex) + endIndexStr.length;

if(startIndex > -1 && endIndex > -1) {
   content = content.substring(0, startIndex) + newContent + content.substring(endIndex);
   fs.writeFileSync(file, content);
   console.log("Patched successfully");
} else {
   console.log("Could not find boundaries");
}
