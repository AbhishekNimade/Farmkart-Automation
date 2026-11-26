import { updateCancelStatus } from './sheets.js';

async function runTest() {
    try {
        console.log("Starting test sheet write...");
        // Let's write to a row within the grid limits (like 1990) to avoid messing up real data
        await updateCancelStatus(1990, "13/07/2026", "99999", "Test State");
        console.log("Test write successful!");
    } catch (e) {
        console.error("Test write failed with error:", e);
    }
}

runTest();
