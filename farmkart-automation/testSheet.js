// import { getOrders } from "./sheets/googleSheets.js";

// console.log("✅ testSheet.js started");

// async function runTest() {
//     try {
//         console.log("➡ Calling getOrders()");
//         const data = await getOrders();

//         console.log("✅ getOrders() returned");
//         console.log("Total rows:", data.length);
//         console.log("First row:", data[0]);
//     } catch (err) {
//         console.error("❌ ERROR inside runTest:", err);
//     }
// }

// runTest();

// console.log("✅ testSheet.js end reached");


import { getOrders } from "./sheets/googleSheets.js";

async function runTest() {
    const orders = await getOrders();
    console.log("Total valid orders:", orders.length);
    console.log("First order:", orders[0]);
}

runTest();
