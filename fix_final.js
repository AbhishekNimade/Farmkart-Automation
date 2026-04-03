const fs = require('fs');
let code = fs.readFileSync('invoice-automation/index.js', 'utf8');

const target1 = `            console.log("👆 Clicking 'Generate New Invoice'...");
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
            await wait(2000);`;

const replace1 = `            console.log("�� Clicking 'Generate New Invoice'...");
            const invoiceLinkLoc = page.locator('a[href*="invoice_new.jsp"], a[href*="addtoexpiry.jsp"]').first();
            
            console.log("⏳ Waiting for new Invoice tab to open...");
            const [invoicePage] = await Promise.all([
                context.waitForEvent('page'),
                invoiceLinkLoc.click()
            ]);
            
            await invoicePage.waitForLoadState('domcontentloaded');
            console.log("✅ Opened New Invoice ('Add Product Expiry') page in a new tab.");
            await wait(2000);`;

code = code.replace(target1, replace1);

const startIdx = code.indexOf(`            // ==========================================
            // PHASE 1: LOOP SETUP & PRODUCT EXTRACTION`);
const endIdx = code.indexOf(`            console.log("🛑 PAUSED: All Products Processed`);

if (startIdx !== -1 && endIdx !== -1) {
    let loopBlock = code.substring(startIdx, endIdx);
    
    // Replace `page.` references inside loop with `invoicePage.` because the elements are on the new popup tab!
    loopBlock = loopBlock.replace(/page\.locator/g, 'invoicePage.locator');
    loopBlock = loopBlock.replace(/page\.waitForSelector/g, 'invoicePage.waitForSelector');
    loopBlock = loopBlock.replace(/page\.bringToFront/g, 'invoicePage.bringToFront');
    loopBlock = loopBlock.replace(/clickAndHighlight\(page/g, 'clickAndHighlight(invoicePage');
    
    code = code.replace(code.substring(startIdx, endIdx), loopBlock);
}

// Restore safe tab close
code = code.replace(
`            // Wait briefly before safely closing the invoice tab to prep for the next order
            await wait(2000);
            console.log("🧹 Finished processing order.");`,
`            // Wait briefly before safely closing the invoice tab to prep for the next order
            await wait(2000);
            await invoicePage.close();
            console.log("🧹 Closed Invoice tab for safety.");`
);

fs.writeFileSync('invoice-automation/index.js', code);
console.log("Global fix applied.");
