export function parseWeight(productName) {
    if (!productName) return 0.5; // Default safe weight

    const name = productName.toLowerCase();

    // Regex for patterns like "500 gm", "1 kg", "500ml", "1ltr"
    // Matches number (int or float) followed explicitly by unit
    const regex = /(\d+(\.\d+)?)\s*(gm|g|kg|ltr|ml)/i;
    const match = name.match(regex);

    if (match) {
        const value = parseFloat(match[1]);
        const unit = match[3].toLowerCase();

        if (unit === 'kg' || unit === 'ltr') {
            return value;
        } else if (unit === 'gm' || unit === 'g' || unit === 'ml') {
            return value / 1000;
        }
    }

    // Fallback if no weight found
    return 0.5;
}

// Keep the old export for backward compatibility if needed, or remove it.
// The new logic is self-contained in parseWeight.
