const fs = require('fs');

const code = fs.readFileSync('invoice-automation/index.js', 'utf8');

// The main loop logic needs an entire rewrite to match:
// 1. Order details page.
// 2. Count products on Order details page.
// 3. Loop each product.
// 4. Get product name from Order details.
// 5. Go to inventory, search, history, stock cancel, print here barcode.
// 6. After all products are extracted? Or open invoice tab inside the loop? Wait, the user said "ek ek step process bataya mene vesehi kam karna he... update status -> search inventory -> stock check -> cancel -> print here -> invoice me aa kar -> verify -> expiry -> shelf -> qty. ek kam hone ke bad hi dusra kam karna hei"
// This implies the loops are:
// "Invoice Tab" is either opened once at the end and EVERYTHING gets filled, OR it's opened once and filled sequentially.
// Since order of inputs must match rows on Invoice Tab, the flow:
// 1. Process Order Button
// 2. Get Products from Order Details OR Open Invoice Tab right away to count and get names?
// The user explicitly wrote: "...is button par click karna he fir confirm karna he fir product name ko inventory me typr karna he... printe here se barcode dekhna he inovce me aa kar bar code dalna he..."
