const fs = require('fs');
let code = fs.readFileSync('invoice-automation/index.js', 'utf8');

const badPopupLogic = `            console.log("👆 Clicking 'Generate New Invoice'...");
            const invoiceLinkLoc = page.locator('a[href*="invoice_new.jsp"], a[href*="addtoexpiry.jsp"]').first();
            
            console.log("⏳ Waiting for new Invoice tab to open...");
            const [invoicePage] = await Promise.all([
                context.waitForEvent('page'),
                invoiceLinkLoc.click()
            ]);
            
            await invoicePage.waitForLoadState('domcontentloaded');
            console.log("✅ Opened New Invoice ('Add Product Expiry') page in a new tab.");
            await wait(2000);`;

const goodFallbackLogic = `            console.log("👆 Clicking 'Generate New Invoice'...");
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

// Let's ensure we are replacing the correct string. We can also just replace `invoicePage` with `page` everywhere because `invoicePage` shouldn't exist anymore.

code = code.replace(badPopupLogic, goodFallbackLogic);
code = code.replace(/invoicePage/g, 'page');

// the close logic needs to go away too
code = code.replace(
`// Wait briefly before safely closing the invoice tab to prep for the next order
            await wait(2000);
            await page.close();
            console.log("🧹 Closed Invoice tab for safety.");`,
`// Wait briefly before safely closing the invoice tab to prep for the next order
            await wait(2000);
            console.log("🧹 Finished processing order.");`
);

fs.writeFileSync('invoice-automation/index.js', code);
console.log("Fixed!");
