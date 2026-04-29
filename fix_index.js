const fs = require('fs');
const file = "invoice-automation/index.js";
let content = fs.readFileSync(file, 'utf8');

const topContent = `const { chromium } = require('playwright');
const readline = require('readline');
const { getPendingOrders, updateSheetRemark } = require('./sheets');
require('dotenv').config({ path: '../order-booking-automation/.env' });

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function ensureLogin(page) {
    const loginUrl = "https://kart.farm:8443/Farmkart/index.jsp?status=logout";
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
    
    const loginFormExists = await page.locator('input[name="strLoginId"]').count() > 0;
    if (loginFormExists) {
        console.log("🔐 Logging in...");
        await page.fill('input[name="strLoginId"]', process.env.FARMKART_ID || "9171663972");
        await page.fill('input[name="strPassword"]', process.env.FARMKART_PWD || "9171663972");
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: "domcontentloaded" }),
            page.click('button[type="submit"]')
        ]);
        console.log("✅ Logged in successfully.");
    } else {
        console.log("✅ Already logged in (or session is still active).");
    }
}

(async () => {
    const args = process.argv.slice(2);
    let startRowIdx = -1;
    if (args.length > 0 && !isNaN(parseInt(args[0], 10))) {
        startRowIdx = parseInt(args[0], 10);
    }

    console.log("=========================================");
    console.log("🌱 Farmkart Invoice Automation");
    if (startRowIdx !== -1) console.log(\`👉 Starting from Sheet Row: \${startRowIdx}\`);
    console.log("=========================================\\n");

    const pendingOrders = await getPendingOrders();

    if (pendingOrders.length === 0) {
        console.log("✅ No pending orders found for invoicing.");
        return;
    }

    console.log(\`🚀 Found \${pendingOrders.length} orders to process.\\n\`);

    const browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized']
    });
    
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

    let processed = 0;

    for (const o of pendingOrders) {
        if (startRowIdx !== -1 && o.sheetRow !== startRowIdx) {
            continue;
        }

        console.log(\`\\n-----------------------------------------\`);
        console.log(\`📦 Processing Order ID: \${o.orderId} (Row \${o.sheetRow})\`);
        
        try {
            await ensureLogin(page);

            const invoiceUrl = \`https://kart.farm:8443/Farmkart/orderdetails.jsp?orderid=\${o.orderId}\`;
            await page.goto(invoiceUrl, { waitUntil: "domcontentloaded" });
            await wait(2000);

            if (page.url().includes("index.jsp")) {
                console.log("⚠️ Session timeout detected. Re-authenticating...");
                await ensureLogin(page);
                await page.goto(invoiceUrl, { waitUntil: "domcontentloaded" });
                await wait(2000);
            }

            console.log(\`✅ Loaded order details for Order ID \${o.orderId}\`);

            const orderProcessingLink = page.locator('a[data-target="#pkg_request"]');
            if (await orderProcessingLink.count() > 0 && await orderProcessingLink.isVisible()) {
                console.log("�� Found 'Update Order status to Order Processing' button. Clicking it...");
                await orderProcessingLink.click();

                console.log("⏳ Waiting 1 second for Confirmation popup to load...");
                await wait(1000);

                console.log("👆 Clicking 'Confirm' button...");
                await Promise.all([
                    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
                    page.click('#OrderStage_Default button.btn-admin_submit[type="submit"]')
                ]);
                console.log("✅ Confirmed order processing. Page reloaded.");
                await wait(2000);
            } else {
                console.log("⏭️ 'Update Order status' button not found. Assuming order is already processed.");
            }

            console.log("👆 Clicking 'Generate New Invoice'...");
            await Promise.all([
                page.waitForNavigation({ waitUntil: "domcontentloaded" }),
                page.click('a[href*="invoice_new.jsp"]')
            ]);
            console.log("✅ Opened New Invoice ('Add Product Expiry') page.");
            await wait(2000);

`;

// Strip leading newlines/spaces from the corrupted content
let cleanContent = content.trim();

// Since the corrupted content stats from // ========================, we can just prepend.
fs.writeFileSync(file, topContent + cleanContent);
console.log("Fixed syntax error by prepending missing logic.");
