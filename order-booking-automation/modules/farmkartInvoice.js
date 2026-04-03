// =====================================================
// File Name : farmkartInvoice.js
// Project   : Order Booking Automation (Farmkart)
// Author    : Abhishek Nimade
// Purpose   :
//  - Login to Farmkart portal
//  - Open invoice URL using Order ID
//  - Extract product & customer data
// =====================================================

import { parseAddress } from "../utils/addressParser.js";
import { parseCustomerName } from "../utils/nameParser.js";
import { parseWeight } from "../utils/weightCalculator.js";
import { FARMKART_SELECTORS } from "../config/selectors.js";


const FARMKART_LOGIN_URL =
    "https://kart.farm:8443/Farmkart/index.jsp?status=logout";
const FARMKART_INVOICE_URL =
    "https://kart.farm:8443/Farmkart/invoice_new.jsp?orderid=";

/**
 * Login to Farmkart portal
 */
export async function loginFarmkart(page) {
    console.log("🔐 Logging into Farmkart...");

    await page.goto(FARMKART_LOGIN_URL, { waitUntil: "domcontentloaded" });

    // Check if already logged in or needs login
    if (page.url().includes("dashboard")) {
        console.log("✅ Already logged in");
        return;
    }

    try {
        await page.fill(
            FARMKART_SELECTORS.usernameInput,
            process.env.FARMKART_USERNAME
        );
        await page.fill(
            FARMKART_SELECTORS.passwordInput,
            process.env.FARMKART_PASSWORD
        );

        await Promise.all([
            page.click(FARMKART_SELECTORS.loginButton),
            page.waitForNavigation({ waitUntil: "domcontentloaded" }),
        ]);

        console.log("✅ Farmkart login successful");
    } catch (e) {
        console.error("❌ Login failed:", e.message);
        throw e;
    }
}

/**
 * Open invoice page
 */
export async function openInvoice(page, orderId) {
    const invoiceUrl = `${FARMKART_INVOICE_URL}${orderId}`;
    if (!page.url().includes(invoiceUrl)) {
        console.log(`📄 Opening invoice for Order ID: ${orderId}`);
        await page.goto(invoiceUrl, { waitUntil: "domcontentloaded" });
    }
}

/**
 * Scrape all details from the Invoice page
 */
export async function scrapeInvoiceDetails(page, orderId) {
    await openInvoice(page, orderId);

    // 1. SCARPE RAW DATA VIA DOM EVALUATION
    const data = await page.evaluate(() => {
        const text = document.body.innerText;
        const tds = Array.from(document.querySelectorAll('td'));

        // --- PRODUCT SCRAPING (Targeting the Table Structure) ---
        let products = [];

        // Find rows that have "(By: - Farmkart)" in their text
        const rows = Array.from(document.querySelectorAll('tr')).filter(tr => tr.innerText.includes("(By: - Farmkart)"));

        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length >= 4) {
                // Column 1: Name, Column 2: Qty, Column 3: Unit Price
                const rawName = cells[1].innerText.split(/\(By:\s*-\s*Farmkart\)/i)[0].trim();
                const cleanName = rawName.replace(/^\d+\s+/, "").trim(); // Remove leading Sr No if present

                const rawQty = cells[2].innerText.trim();
                const rawPrice = cells[3].innerText.trim();

                products.push({
                    name: cleanName,
                    qty: Math.round(parseFloat(rawQty)) || 1,
                    price: parseFloat(rawPrice.replace(/,/g, '')) || 0
                });
            }
        });

        // --- CUSTOMER SCRAPING ---
        // Look for "Ship To:" block
        const shipToMatches = text.match(/Ship To:([\s\S]*?)Pincode\s*-\s*(\d{6})/);
        const shipToBlock = shipToMatches ? shipToMatches[0] : "";

        // Look for Phone: 10 digit number
        const phoneMatch = text.match(/\b[6789]\d{9}\b/);
        const phone = phoneMatch ? phoneMatch[0] : "";

        // --- PAYMENT SCRAPING ---
        let codAmount = 0;
        const codRow = tds.find(td => td.innerText.toLowerCase().includes("cash on delivery"));
        if (codRow) {
            const parent = codRow.parentElement;
            const amountText = parent.innerText.match(/(\d+(\.\d+)?)/g);
            if (amountText && amountText.length > 0) {
                codAmount = parseFloat(amountText[amountText.length - 1]);
            }
        }

        return {
            products,
            shipToBlock,
            phone,
            codAmount,
            fullText: text
        };
    });

    if (data.products.length === 0 && !data.fullText) {
        throw new Error("Failed to scrape data or no products found");
    }

    // 2. PARSE DATA (Node.js side)

    // A. PRODUCT
    const parsedProducts = data.products.map(item => {
        const weight = parseWeight(item.name);
        return {
            name: item.name,
            qty: item.qty,
            price: item.price,
            weight,
            sku: Math.floor(1000 + Math.random() * 9000).toString()
        };
    });

    // B. CUSTOMER
    const { firstName, lastName } = parseCustomerName(data.shipToBlock); // Heuristic if name inside?
    // Wait, name might NOT be in data.shipToBlock if it starts with "Address -".
    // User said: "soft copy me customer ke name ke niche he phone no"
    // If phone is found, name is likely line above it?
    // Let's rely on finding a line that isn't phone/address.
    // For now, I'll extract name from the "one line above phone" concept if possible, 
    // OR just use a specific scrape for "Name" if I can find the pattern from `data.fullText`.

    // Enhanced Name Extraction Strategy:
    // User Mentioned: "Pankaj Patidar" text exists.
    // I will try to find the phone number in `data.fullText` and take the line before it.
    let customerNameRaw = "";
    if (data.phone) {
        const lines = data.fullText.split('\n').map(l => l.trim()).filter(l => l);
        const phoneIdx = lines.findIndex(l => l.includes(data.phone));
        if (phoneIdx > 0) {
            customerNameRaw = lines[phoneIdx - 1]; // Line before phone
        }
    }
    const { firstName: fName, lastName: lName } = parseCustomerName(customerNameRaw || "Unknown Customer");

    // C. ADDRESS
    const addressDetails = parseAddress(data.shipToBlock);

    // D. Return All Products
    return {
        orderId,
        products: parsedProducts,
        customer: {
            firstName: fName,
            lastName: lName,
            phone: data.phone,
            address: addressDetails.address1,
            pincode: addressDetails.pincode
        },
        payment: {
            isCod: data.codAmount > 0,
            amount: data.codAmount // "Collectable Amount"
        }
    };
}
