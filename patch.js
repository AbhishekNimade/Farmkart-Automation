const fs = require('fs');

let code = fs.readFileSync('invoice-automation/index.js', 'utf8');

// We simply need to move the "invoice page opening block" to happen AFTER "order processing" but BEFORE the loop starts.
// Wait, the user said:
// - Update Order status to Order Processing button click
// - confirm
// - product name ko inventory me typr karna he serch karna he (from orderdetails page!)
// - stock cheak karna he fir cancel karna he 
// - printe here se barcode dekhna he 
// - inovce me aa kar bar code dalna he (meaning invoice page MUST be opened now!)
// - uske bad verify ...
// SO we have to restructure the loop.

// First let's extract the product names directly from the Order Details page.
// The products are listed in a table on `orderdetails.jsp`.

// Since restructuring the entire script is complex, I will use `replace_file_content` block by block on `index.js`
