const fs = require('fs');
const file = "invoice-automation/index.js";
let content = fs.readFileSync(file, 'utf8');

// The replacement content
const newContent = `
            // ==========================================
            // PHASE 1: EXTRACT INFO & INVENTORY CHECK
            // ==========================================
            console.log("🔍 Extracting Product Name and Net Qty...");
            
            // Smarter extraction using text locators since IDs and names are failing
            // The structure is usually a label "Farmkart Product" over an input, or similar.
            const productName = await page.locator('text="Farmkart Product"').locator('..').locator('input').first().inputValue().catch(async () => {
                // Try finding any readonly input or the first text input inside the main panel
                const inputs = page.locator('input[type="text"][readonly], input.form-control[readonly]');
                if (await inputs.count() > 0) return await inputs.first().inputValue();
                return "Unknown Product";
            });

            const netQtyStr = await page.locator('text="Net Qty"').locator('..').locator('input').first().inputValue().catch(async () => {
                 // Try another structural guess
                 const textInputs = page.locator('input[type="text"]');
                 if (await textInputs.count() >= 2) return await textInputs.nth(1).inputValue(); // often the second input
                 return "1.0";
            });
            const netQty = parseFloat(netQtyStr) || 1.0;

            console.log(\`📌 Found Product: "\${productName}", Net Qty: \${netQty}\`);

            console.log("🌐 Opening Inventory List in a NEW tab...");
            const inventoryPageUrl = "https://kart.farm:8443/Farmkart/inventoryList.jsp";
            
            // Create a new page (tab) in the same browser context so login persists
            const inventoryContext = page.context();
            const inventoryTab = await inventoryContext.newPage();
            
            await inventoryTab.goto(inventoryPageUrl, { waitUntil: "domcontentloaded" });
            await wait(2000);

            console.log(\`⌨️ Searching for "\${productName}" in Inventory...\`);
            await inventoryTab.fill('input[type="search"]', productName.trim());
            await wait(1500); // Table filtering delay

            console.log("👆 Clicking 'History' for the matched product...");
            // Matches the first row's History button in the filtered table
            await Promise.all([
                inventoryTab.waitForNavigation({ waitUntil: "domcontentloaded" }),
                inventoryTab.click('a.btn-info:has-text("History")') // adjust selector if needed, usually looks like this
            ]);
            await wait(2000);

            // ==========================================
            // PHASE 2: STOCK VERIFICATION (PACKAGING)
            // ==========================================
            console.log("👆 Clicking 'Stock Location'...");
            await inventoryTab.click('button:has-text("Stock Location"), a:has-text("Stock Location")');
            await wait(1000); // Wait for popup

            console.log("🔍 Extracting 'Packaging' quantity...");
            // We find the table row containing "Packaging" and get the 2nd column
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
                // The user has paused the bot here until the 'else' condition is built
                await inventoryTab.close();
                throw new Error("INSUFFICIENT_STOCK_IN_PACKAGING");
            }

            // ==========================================
            // PHASE 3: BARCODE EXTRACTION
            // ==========================================
            console.log("👆 Clicking 'PRINT HERE' to grab barcode...");
            
            // We need to wait for the new popup window that Farmkart triggers
            const [popup] = await Promise.all([
                inventoryTab.waitForEvent('popup'),
                inventoryTab.click('a:has-text("PRINT HERE")')
            ]);
            
            await popup.waitForLoadState();
            await wait(1000);

            console.log("�� Extracting barcode text...");
            // Assuming barcode text is prominently displayed on the popup page body
            const rawBarcode = await popup.$eval('body', el => el.innerText);
            
            // The raw barcode usually looks like *646-C388*
            // We regex match the format or just strip asterisks and trim. 
`;

// Extract before/after parts to inject correctly using string manipulation instead of standard replace limits
const startIndex = content.indexOf('// ==========================================');
const endIndex = content.indexOf('const cleanBarcodeMatch = rawBarcode.match(/\\*(.*?)\\*/);');

if(startIndex > -1 && endIndex > -1) {
   content = content.substring(0, startIndex) + newContent + content.substring(endIndex);
   fs.writeFileSync(file, content);
   console.log("Patched successfully");
} else {
   console.log("Could not find boundaries");
}
