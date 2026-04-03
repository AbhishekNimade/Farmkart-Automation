const { chromium } = require('playwright');
require('dotenv').config({ path: '../order-booking-automation/.env' });

(async () => {
    const browser = await chromium.launch({ headless: false, slowMo: 100 });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto("https://kart.farm:8443/Farmkart/");
    await page.fill('#username', process.env.FARMKART_USERNAME);
    await page.fill('#password', process.env.FARMKART_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    
    await page.goto("https://kart.farm:8443/Farmkart/inventoryList.jsp");
    console.log("Logged in and opened inventory");
    
    const searchInput = page.locator('input[type="search"], .dataTables_filter input, input[placeholder*="Search" i]').first();
    await searchInput.fill('Combo Pack D-Mart, Growth Promoter + Fungicide, 500 gm');
    const searchBtnSelector = 'button:has-text("Search"), input[type="submit"][value="Search"], .btn-search, i.fa-search';
    await page.locator(searchBtnSelector).first().click({ force: true });
    
    await page.waitForTimeout(3000); // Wait for results

    // Check for history buttons specifically
    const historyButtons = await page.locator('text="History"');
    console.log(`Found ${await historyButtons.count()} "History" elements`);
    
    if(await historyButtons.count() > 0) {
       await historyButtons.first().click({force: true});
       await page.waitForLoadState("domcontentloaded");
       console.log("We are on history page:", page.url());
       
       await page.locator('button:has-text("Stock Location"), a:has-text("Stock Location")').click({force: true});
       await page.waitForTimeout(3000);
       
       const modalText = await page.locator('.modal-dialog, .modal-content, #StockLocationModel, .show.modal, .modal').innerHTML();
       console.log("Stock Modal HTML size:", modalText.length);

    }
    await browser.close();
})();
