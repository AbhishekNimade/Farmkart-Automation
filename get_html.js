const { chromium } = require('playwright');
require('dotenv').config({ path: '../order-booking-automation/.env' });

(async () => {
    try {
        const browser = await chromium.launch({ headless: false });
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await page.goto("https://kart.farm:8443/Farmkart/");
        await page.fill('#username', process.env.FARMKART_USERNAME);
        await page.fill('#password', process.env.FARMKART_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForNavigation();
        
        await page.goto("https://kart.farm:8443/Farmkart/orderdetails.jsp?orderid=211364", { waitUntil: "domcontentloaded" });
        
        const html = await page.locator('table.table-striped').innerHTML();
        console.log(html);
        await browser.close();
    } catch(err) {
        console.error(err);
    }
})();
