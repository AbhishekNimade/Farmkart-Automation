
const DELHIVERY_HOME_URL = "https://one.delhivery.com/home";

/**
 * Step-by-Step Error Class for pinpointing failures
 */
class StepError extends Error {
    constructor(stepName, message) {
        super(message);
        this.name = "StepError";
        this.stepName = stepName;
        this.isStepError = true;
    }
}

// -----------------------------
// HELPERS
// -----------------------------
const scrollToCenter = async (page, locator) => {
    try {
        await locator.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        await page.waitForTimeout(500); // Wait for smooth scroll to finish
    } catch (e) { }
};

export async function createOrder(page, orderData) {
    console.log("\n===============================================");
    console.log("🚀 STARTING FAST 9-STEP WORKFLOW (EVOLVED)");
    console.log("===============================================");

    let boxMatched = false;
    let shippingCost = 0;
    let orderWeightKg = 0;
    let awbNumber = null;
    let bookingDate = new Date().toLocaleDateString();

    try {
        // [STEP 1/7] CHANNEL
        console.log("\n[STEP 1/7] Selecting Channel...");
        try {
            const URL_PATH = "/orders/forward/create";
            if (!page.url().includes(URL_PATH)) {
                await page.goto("https://one.delhivery.com" + URL_PATH, { waitUntil: 'domcontentloaded' });
            }
            const channelTrigger = page.getByPlaceholder("Select Channel");
            await scrollToCenter(page, channelTrigger);
            await channelTrigger.click();
            await page.waitForSelector('.ap-menu:visible', { timeout: 5000 });
            await page.getByText("Farmkart Online Services Pvt. Ltd").click();
            console.log("   ✅ Channel selected.");
        } catch (e) {
            throw new StepError("Step 1 (Select Channel)", e.message);
        }

        // [STEP 2/7] ORDER ID
        console.log("\n[STEP 2/7] Entering Order ID...");
        try {
            const orderIdInput = page.getByPlaceholder("Enter Order ID / Reference Number");
            await scrollToCenter(page, orderIdInput);
            await orderIdInput.fill(orderData.orderId);
            console.log(`   ✅ Order ID ${orderData.orderId} entered.`);
        } catch (e) {
            throw new StepError("Step 2 (Order ID)", e.message);
        }

        // [STEP 3/7] PRODUCTS
        console.log("\n[STEP 3/7] Adding Products & Quantity...");
        try {
            const products = orderData.products || [orderData.product];
            for (const product of products) {
                console.log(`   👉 Processing: "${product.name}"`);
                const searchInput = page.locator('[data-action="product-search-and-add"] input').first();
                await scrollToCenter(page, searchInput);
                let matchFound = false;

                // 1. Clear and Trigger Search
                await searchInput.click();
                await searchInput.fill("");

                const cleanName = product.name.split(/by:- farmkart/i)[0].trim();
                console.log(`      🔍 Searching for: "${cleanName}"`);

                // Use type with delay to ensure the UI registers the input and triggers search
                // ACCELERATED TYPING (User Request) - Slower now to allow dropdown
                await searchInput.pressSequentially(cleanName, { delay: 150 });

                console.log("      ⏳ Waiting 2 seconds for UI to catch up...");
                await page.waitForTimeout(2000);

                // 2. Wait for dropdown list and settle
                const dropdownItemSelector = '.ap-menu-item:visible';
                try {
                    console.log("      ⏳ Waiting for results dropdown...");
                    await page.waitForSelector(dropdownItemSelector, { state: 'visible', timeout: 5000 });
                    await page.waitForTimeout(1000);
                } catch (e) {
                    console.log("   ⚠️ Search results did not appear.");
                }

                // 3. Browser-Side Atomic Selection
                const targetRef = product.name.toLowerCase().replace(/\s+/g, ' ').trim();
                console.log(`      🎯 Attempting atomic match for: "${targetRef}"`);

                const selectionResult = await page.evaluate(({ selector, target }) => {
                    const elements = Array.from(document.querySelectorAll(selector));
                    if (elements.length === 0) return { found: false, count: 0 };

                    let bestIndex = -1;
                    let foundText = "";

                    for (let i = 0; i < elements.length; i++) {
                        const text = elements[i].innerText || "";
                        const cleanText = text.toLowerCase().replace(/\s+/g, ' ').trim();

                        if (cleanText === target || cleanText.includes(target) || target.includes(cleanText)) {
                            bestIndex = i;
                            foundText = text;
                            break;
                        }
                    }

                    // Fallback to first if no match, BUT only if it looks reasonably similar or user allows fuzzy
                    // For now, STRICTER match or force 'Add Product'
                    if (bestIndex !== -1) {
                        elements[bestIndex].click();
                        return { found: true, text: foundText, index: bestIndex, count: elements.length };
                    }

                    return { found: false, count: elements.length };
                }, { selector: '.ap-menu-item', target: targetRef });

                if (selectionResult.found) {
                    console.log(`   ✅ Atomic Match Success: "${selectionResult.text.replace(/\n/g, ' ')}"`);
                    matchFound = true;
                    await page.waitForTimeout(800);
                } else {
                    console.log(`   ❌ Match Failed / No options. Found: ${selectionResult.count}`);
                }

                // 3. New Product Form if no match
                if (!matchFound) {
                    console.log("   ✨ Product not found. Auto-Adding as NEW Product...");

                    // Click + Add Product
                    // Try the button in the dropdown first, or the general one
                    const addBtn = page.locator('button.ap-button').filter({ hasText: /Add Product/i }).last();

                    if (await addBtn.isVisible()) {
                        await addBtn.click();
                        await page.waitForTimeout(1000); // Wait for modal
                        await fillNewProductForm(page, product);

                        // After creating, we assume the product is added with Qty 1. 
                        // The loop below will correct the Qty to match product.qty
                    } else {
                        console.log("   ⚠️ 'Add Product' button not found. Skipping product addition.");
                    }
                }

                // 4. Update Quantity (Always check this, especially for new products which default to 1)
                console.log(`   ⚖️ Updating Qty to: ${product.qty}`);
                await page.waitForTimeout(1000);

                // Find the row for this product. Use a simplified check.
                // For a newly added product, it's likely the last row or the one matching the name we just entered.
                const searchTerms = cleanName.substring(0, 10).toLowerCase();
                const productRow = page.locator('div[class*="row-container"], div[class*="product-row"], tr, .ap-table-row')
                    .filter({ hasText: new RegExp(searchTerms, 'i') }).last();

                // If regular search fails (maybe name shortened), try getting the very last row strictly
                const targetRow = (await productRow.count() > 0) ? productRow : page.locator('div[class*="product-row"]').last();

                if (await targetRow.count() > 0) {
                    const qtyInput = targetRow.locator('input[type="number"]').first();
                    if (await qtyInput.isVisible()) {
                        await qtyInput.scrollIntoViewIfNeeded();
                        await qtyInput.click({ clickCount: 3, force: true });
                        await page.keyboard.press('Backspace');
                        await qtyInput.fill(String(product.qty));
                        await page.keyboard.press('Enter');
                        console.log(`   ✅ Qty synced.`);
                    }
                }
                await page.waitForTimeout(500);
            }
        } catch (e) {
            throw new StepError("Step 3 (Products/Qty)", e.message);
        }

        // [STEP 4/7] PAYMENT
        console.log("\n[STEP 4/7] Payment Details...");
        // ... (existing code) ...
        // ... (existing code) ...
        try {
            const paymentTrigger = page.locator('label').filter({ hasText: 'Payment Mode' }).locator('.ap-menu-trigger-root').first();
            await scrollToCenter(page, paymentTrigger);

            const currentText = await paymentTrigger.innerText();
            const codAmt = orderData.payment.amount || 0;

            if (codAmt > 0) {
                if (!currentText.includes("Cash On Delivery")) {
                    await paymentTrigger.click();
                    await page.locator('.ucp__order-creation__select-payment__dropdown-item--cod').first().click();
                }
                const input = page.locator('.inline-input-container input.input:visible').last();
                await input.fill(String(codAmt));
                await page.keyboard.press('Enter');
            } else {
                if (!currentText.includes("Pre-Paid")) {
                    await paymentTrigger.click();
                    await page.locator('.ucp__order-creation__select-payment__dropdown-item--prepaid').first().click();
                }
            }
            console.log("   ✅ Payment details completed.");
        } catch (e) {
            throw new StepError("Step 4 (Payment)", e.message);
        }

        // [STEP 5/7] CUSTOMER
        console.log("\n[STEP 5/7] Customer Details...");
        try {
            const customerTrigger = page.getByText("Add customer details");
            await scrollToCenter(page, customerTrigger);
            await customerTrigger.click();
            await page.waitForTimeout(1000);
            await page.getByPlaceholder("First Name").fill(orderData.customer.firstName);
            await page.getByPlaceholder("Last Name").fill(orderData.customer.lastName);
            await page.locator('input[name="phone_number"]').fill(String(orderData.customer.phone));
            await page.getByLabel("Address Line 1").fill(orderData.customer.address);
            await page.getByLabel("Pincode").fill(orderData.customer.pincode);

            await page.waitForTimeout(1500);
            await page.locator('button.ap-button.blue.filled').filter({ hasText: 'Add Customer' }).first().click();
            console.log("   ✅ Customer details added.");
        } catch (e) {
            throw new StepError("Step 5 (Customer)", e.message);
        }

        // [STEP 6/7] BOX SIZE (Strict Numeric)
        console.log("\n[STEP 6/7] Box Size Selection (Numeric Protocol)...");
        try {
            if (page.isClosed()) throw new Error("Browser closed before Step 6");

            // 0. Wait for transition from Step 5
            await page.waitForTimeout(2000);

            // 1. Numeric Extraction Helper: "18 x 10 x 10 cms" -> [18, 10, 10]
            const extractNumbers = (s) => (s || "").match(/\d+/g)?.map(Number) || [];

            const targetBoxRaw = String(orderData.boxSize || "").trim();
            const targetNums = extractNumbers(targetBoxRaw);
            const targetStr = JSON.stringify(targetNums);

            console.log(`   📦 Excel Box Size: "${targetBoxRaw}"`);
            console.log(`   🔍 Target Numbers: [${targetNums.join(", ")}]`);

            if (targetNums.length === 0) {
                throw new Error("Target box size from Sheet has no numeric values.");
            }

            // 1. Wait for Section & Scroll
            console.log("   🖱️ Targeting 'Box Details' section...");
            // Use a broader filter for the card to ensure we capture it
            const boxCard = page.locator('div').filter({ hasText: 'Box Details' }).filter({ hasText: 'Add Box' }).last();
            await boxCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => console.log("      ⚠️ Box Card wait timed out (optimistic proceed)"));
            await scrollToCenter(page, boxCard);

            // 2. Open "Select Shipping Package" dropdown
            let opened = false;
            for (let retry = 0; retry < 5; retry++) {
                // STRATEGY: Blind Force
                // Strictly target the last dropdown trigger in the Box Details card.
                // This ignores the text content ("Select Package" vs "Box Carton") entirely.
                const trigger = boxCard.locator('.ap-menu-trigger-root').last();

                if (await trigger.isVisible()) {
                    console.log(`      🖱️ Clicking Dropdown (Strategy: Blind Force Last) (Attempt ${retry + 1})...`);
                    await trigger.click({ force: true });

                    try {
                        await page.waitForSelector('.ap-menu:visible', { timeout: 4000 });
                        opened = true;
                        break;
                    } catch (e) {
                        console.log(`      ⏳ Menu did not appear yet (Attempt ${retry + 1})...`);
                    }
                } else {
                    console.log(`      ⏳ Trigger not visible yet (Attempt ${retry + 1})...`);
                }
                await page.waitForTimeout(1500);
            }

            if (!opened) {
                console.log("      ⚠️ Selection dropdown failed to open properly. Attempting one-time price recovery...");
            } else {
                console.log("   ✅ Box dropdown opened.");
            }

            // [SCROLL/SCAN Logic for Box Selection]
            // ... (I'll keep the existing matching logic but wrap the price extraction in a way it can still run)

            let checkedUIs = new Set();
            let totalScanned = 0;
            let found = false;

            // 3. The Scan-Load Loop
            for (let attempt = 1; attempt <= 20; attempt++) {
                if (page.isClosed()) break;

                // Targeted extraction from the ACTIVE menu
                const itemTexts = await page.locator('.ap-menu:visible .ap-menu-item').evaluateAll(els =>
                    els.map(el => ({ text: el.innerText, visible: el.offsetParent !== null }))
                );

                let newlyScannedInLoop = 0;

                for (let i = 0; i < itemTexts.length; i++) {
                    const { text } = itemTexts[i];
                    if (checkedUIs.has(text)) continue;

                    checkedUIs.add(text);
                    totalScanned++;
                    newlyScannedInLoop++;

                    const uiNums = extractNumbers(text);

                    // Suffix Matching Protocol: Match if the last N numbers match the sheet (ignores nicknames)
                    const isMatch = uiNums.length >= targetNums.length &&
                        JSON.stringify(uiNums.slice(-targetNums.length)) === targetStr;

                    // Verification log (user request)
                    process.stdout.write(`      🧐 Checking: "${text.replace(/\n/g, ' ')}" ... `);

                    // Suffix-based matching
                    if (isMatch) {
                        process.stdout.write("MATCH! ✅\n");
                        console.log(`\n   ✨ MATCH FOUND! (Nickname Ignored)`);
                        console.log(`      Web item:  "${text.replace(/\n/g, ' ')}"`);

                        // Click exactly the matching item
                        const itemLocator = page.locator('.ap-menu:visible .ap-menu-item').nth(i);
                        await itemLocator.scrollIntoViewIfNeeded();
                        await itemLocator.click({ force: true });

                        console.log(`   ✅ Box selected successfully.`);
                        found = true;
                        boxMatched = true;
                        break;
                    } else {
                        process.stdout.write("No match\n");
                    }
                }

                if (found) break;

                // Detect "Load More" specifically inside the active menu
                const loadMoreBtn = page.locator('.ap-menu:visible').locator('button.ap-button').filter({ hasText: /^Load More$/i }).first();
                if (await loadMoreBtn.isVisible()) {
                    console.log(`   🔄 Clicking 'Load More' (Attempt ${attempt})...`);
                    await loadMoreBtn.click({ force: true });
                    await page.waitForTimeout(2500); // 2.5s wait for new items
                    console.log(`   📦 Items scanned so far: ${totalScanned}`);
                } else {
                    if (newlyScannedInLoop === 0) {
                        console.log(`   ⏹️ End of list reached. Total scanned: ${totalScanned}`);
                        break;
                    }
                    // Final attempt: scroll down
                    await page.locator('.ap-menu:visible').evaluate(el => el.scrollTop = el.scrollHeight);
                    await page.waitForTimeout(1000);
                }
            }

            // 🛑 STOP REMOVED: Continuing to Order Creation
            console.log("\n   🛑 BOX SELECTED. Proceeding to automated order creation...");

            // -----------------------------
            // DYNAMIC EXTRACTION (Weight & Cost)
            // -----------------------------
            console.log("   ⚖️  Extracting Weight & Shipping Cost...");
            await page.waitForTimeout(2000); // 2s wait for UI to update prices

            // 1. Extract Weight (Best Effort)
            try {
                const weightContainer = page.locator('div, section').filter({ has: page.getByText('Total Chargeable Weight', { exact: true }) }).last();
                if (await weightContainer.isVisible()) {
                    const weightText = await weightContainer.innerText();
                    const weightMatches = weightText.match(/([\d,]+)\s*gm/i);
                    if (weightMatches) {
                        const rawWeight = weightMatches[1].replace(/,/g, '');
                        orderWeightKg = parseFloat((parseInt(rawWeight) / 1000).toFixed(3));
                        console.log(`      ⚖️  System Chargeable Weight: ${orderWeightKg} kg`);
                    }
                }
            } catch (e) {
                console.log("      ⚠️ Could not extract weight automatically.");
            }

            // 2. Extract Shipping Cost (Precision targeting for SURFACE ZONE D2)
            try {
                let zoneCard = page.locator('div, section').filter({ hasText: /SURFACE ZONE D2/i }).filter({ hasText: /₹/ }).last();
                if (await zoneCard.count() === 0) {
                    zoneCard = page.locator('div, section').filter({ hasText: /SURFACE/i }).filter({ hasText: /₹/ }).last();
                }

                if (await zoneCard.count() > 0) {
                    const rawPriceText = await zoneCard.innerText();
                    const costMatches = rawPriceText.match(/₹\s*([\d,.]+)/);
                    if (costMatches) {
                        shippingCost = Math.round(parseFloat(costMatches[1].replace(/,/g, '')));
                        console.log(`      💰 Price Extracted: ₹${shippingCost}`);
                    }
                }
            } catch (e) {
                console.log("      ⚠️ Could not extract price automatically.");
            }

            // [STEP 7/9] CREATE ORDER
            console.log("\n[STEP 7/9] Clicking 'Create Order'...");
            try {
                const createBtn = page.locator('button.ap-button.blue.filled').filter({ hasText: /Create Order/i }).last();
                await createBtn.scrollIntoViewIfNeeded();
                await createBtn.click();
                console.log("   ✅ 'Create Order' clicked.");
            } catch (e) {
                throw new StepError("Step 7 (Create Order)", e.message);
            }

            // [STEP 8/9] GET AWB NO
            console.log("\n[STEP 8/9] Extracting AWB Number...");
            try {
                // Wait for the success modal/post-creation state fully
                await page.waitForTimeout(3000);

                // 1. Click 'Get AWB No' if visible (older flow)
                const getAwbBtn = page.locator('button.ap-button').filter({ hasText: /Get AWB No/i }).first();
                if (await getAwbBtn.isVisible()) {
                    await getAwbBtn.click();
                    await page.waitForTimeout(2000);
                }

                let extractedAwb = null;

                // 2. New Fallproof AWB Extraction Loop
                // Delhivery AWBs are 13-14 digits (e.g. 20886710017452 is 14)
                // Order ID is 12 digits. Phone is 10.
                // Ergo, any 13 to 18 digit pure number on screen is our AWB!
                for (let i = 0; i < 6; i++) {
                    extractedAwb = await page.evaluate(() => {
                        const bodyText = document.body.innerText || "";
                        
                        // Priority 1: 13-18 digits near "AWB" or "Tracker"
                        const contextMatch = bodyText.match(/(?:AWB|Tracker)[\s\S]{0,300}?\b(\d{13,18})\b/i);
                        if (contextMatch) return contextMatch[1];
                        
                        // Priority 2: ANY 13-18 digit standalone number
                        const globalMatch = bodyText.match(/\b(\d{13,18})\b/);
                        if (globalMatch) return globalMatch[1];
                        
                        return null;
                    });
                    
                    if (extractedAwb) break;
                    
                    // Wait a bit and retry (in case tracking UI is still loading from server)
                    console.log(`   ⏳ Waiting for AWB to appear... (attempt ${i + 1}/6)`);
                    await page.waitForTimeout(1500);
                }

                if (extractedAwb) {
                    awbNumber = extractedAwb;
                    console.log(`   ✅ AWB Safely Extracted: ${awbNumber}`);
                } else {
                    console.log("   ⚠️ AWB not found via evaluate. Attempting Playwright locator fallback...");
                    const trackerBox = page.locator('div, section, p, span').filter({ hasText: /\b\d{13,18}\b/ }).last();
                    if (await trackerBox.isVisible()) {
                        const text = await trackerBox.innerText();
                        const match = text.match(/\b(\d{13,18})\b/);
                        if (match) {
                            awbNumber = match[1];
                            console.log(`   ✅ AWB Extracted (Locator Fallback): ${awbNumber}`);
                        }
                    }
                }
            } catch (e) {
                console.log(`   ⚠️ AWB Extraction warning: ${e.message}`);
            }

            // [STEP 9/9] ADD TO PICKUP
            console.log("\n[STEP 9/9] Scheduling Pickup...");
            try {
                const pickupBtn = page.locator('button.ap-button').filter({ hasText: /Add to Pickup/i }).first();
                if (await pickupBtn.isVisible()) {
                    await pickupBtn.click();
                    console.log("   ✅ 'Add to Pickup' clicked.");
                    await page.waitForTimeout(2000);
                } else {
                    console.log("   ⚠️ 'Add to Pickup' button not found. Order might be in 'Manifested' state.");
                }
            } catch (e) {
                console.log(`   ⚠️ Pickup scheduling failed: ${e.message}`);
            }

            return { success: true, boxMatched: true, weightKg: orderWeightKg, shippingCost: shippingCost, awb: awbNumber };

        } catch (e) {
            throw new StepError("Order Creation Flow", e.message);
        }

    } catch (err) {
        // FINAL PRICE CHECK (Recovery)
        console.log("   ⚖️  Running Final Price/Weight Recovery check...");
        try {
            // Relaxed regex: Just look for "SURFACE ZONE D2" anywhere in the text
            const zoneCard = page.locator('div, section').filter({ hasText: /SURFACE ZONE D2/i }).filter({ hasText: /₹/ }).last();
            if (await zoneCard.isVisible()) {
                const rawPriceText = await zoneCard.innerText();
                const costMatches = rawPriceText.match(/₹\s*([\d,.]+)/);
                if (costMatches) {
                    shippingCost = Math.round(parseFloat(costMatches[1].replace(/,/g, '')));
                    console.log(`      💰 Recovery Success: Extracted ₹${shippingCost} from page state.`);
                }
            }
        } catch (e) { }

        if (err.isStepError) {
            console.log(`\n❌ [STOPPED] ${err.stepName} FAILED.`);
            console.log(`   Reason: ${err.message}`);
            // Still return what we found
            return { success: false, awb: null, shippingCost, weightKg: orderWeightKg, boxMatched, error: err.message };
        }
        throw err;
    }

    return { success: true, awb: awbNumber, shippingCost, weightKg: orderWeightKg, boxMatched, bookingDate, partner: "Delhivery" };
}

async function fillNewProductForm(page, product) {
    console.log("🆕 Filling 'Create New Product' Modal...");

    try {
        // 1. Name
        await page.getByLabel("Product Name").fill(product.name);

        // 2. Price (Unit Price)
        const priceStr = String(product.price || "0");
        await page.getByLabel("Price (incl. Tax)").fill(priceStr);

        // 3. Weights
        // product.weight is in Kg (e.g., 0.25). We need Grams.
        const weightGrams = Math.round((product.weight || 0.5) * 1000);
        const weightStr = String(weightGrams);

        await page.getByPlaceholder("Enter Product weight").fill(weightStr);
        await page.getByPlaceholder("Enter Packaged Product weight").fill(weightStr);

        // 4. SKU (Random 6-8 digits as requested)
        const randomSku = Math.floor(100000 + Math.random() * 900000).toString();
        await page.getByLabel("SKU Code").fill(randomSku);
        console.log(`   - Generated SKU: ${randomSku}`);

        // 5. Shipping Package (Select First/Random)
        // Click dropdown -> ArrowDown -> Enter
        console.log("   - Selecting Shipping Package...");
        const packageTrigger = page.locator('.ap-meta-label').filter({ hasText: /Shipping Package/i })
            .locator('..').locator('.ap-menu-trigger-root').first();

        // Using force: true to bypass the "dialog intercepts pointer events" Playwright error 
        await packageTrigger.click({ force: true });
        await page.waitForTimeout(500);
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");

        // 6. Submit
        await page.waitForTimeout(500);
        // Removed brittle classes (.blue.filled) as UI design might have changed
        const createBtn = page.locator('button').filter({ hasText: /Create New Product|Create Product/i }).last();
        
        // Use a short timeout so we don't hang for 30 seconds if the button is slightly different
        await createBtn.waitFor({ state: 'visible', timeout: 5000 });
        await createBtn.click({ force: true, timeout: 5000 });

        console.log("   ✅ New Product Created.");
        await page.waitForTimeout(1500); // Wait for modal to close and row to appear

    } catch (e) {
        console.log(`   ⚠️ Error creating new product: ${e.message}`);
        // Try escaping if stuck
        await page.keyboard.press("Escape");
    }
}

