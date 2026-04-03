const fs = require('fs');
const file = "invoice-automation/index.js";
let content = fs.readFileSync(file, 'utf8');

// The replacement content
const newContent = `
            // Handle potential silent redirects to login page by Farmkart
            if (page.url().includes("index.jsp")) {
                console.log("⚠️ Session timeout detected. Re-authenticating...");
                await ensureLogin();
                // Retry navigating to the invoice
                await page.goto(invoiceUrl, { waitUntil: "domcontentloaded" });
                await wait(2000);
            }

            console.log(\`✅ Loaded invoice page for Order ID \${o.orderId}\`);

            // Check if "Update Order status to Order Processing" button exists
            const orderProcessingLink = page.locator('a[data-target="#pkg_request"]');
            if (await orderProcessingLink.count() > 0 && await orderProcessingLink.isVisible()) {
                console.log("👆 Found 'Update Order status to Order Processing' button. Clicking it...");
                await orderProcessingLink.click();

                console.log("⏳ Waiting 1 second for Confirmation popup to load...");
                await wait(1000);

                // Click the 'Confirm' button in the popup targeting the specific form
                console.log("👆 Clicking 'Confirm' button...");
                await Promise.all([
                    page.waitForNavigation({ waitUntil: "domcontentloaded" }), // The form submit reloads the page
                    page.click('#OrderStage_Default button.btn-admin_submit[type="submit"]')
                ]);
                console.log("✅ Confirmed order processing. Page reloaded.");
                await wait(2000); // Give the UI a moment to stabilize
            } else {
                console.log("⏭️ 'Update Order status' button not found. Assuming order is already processed.");
            }

            console.log("👆 Clicking 'Generate New Invoice'...");
`;

const startIndex = content.indexOf('// Handle potential silent redirects to login page by Farmkart');
const endIndexStr = 'console.log("👆 Clicking \'Generate New Invoice\'...");';
const endIndex = content.indexOf(endIndexStr, startIndex) + endIndexStr.length;

if(startIndex > -1 && endIndex > -1) {
   content = content.substring(0, startIndex) + newContent + content.substring(endIndex);
   fs.writeFileSync(file, content);
   console.log("Patched successfully");
} else {
   console.log("Could not find boundaries");
}
