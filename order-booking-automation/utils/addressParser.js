
/**
 * Parses the raw address string from Farmkart invoice.
 * Example Input: "Ship To: Address - Mohanpura, Village - Mohanpura, Tehsil - Petlawad, District - Jhabua, State - Madhya Pradesh , Pincode - 457770"
 * 
 * Rules:
 * 1. Extract Pincode (6 digits).
 * 2. Address Line 1: From "Address -" up to "Tehsil - <Name>".
 */
export function parseAddress(rawAddress) {
    if (!rawAddress) return { address1: "", pincode: "" };

    // 1. Extract Pincode
    const pincodeMatch = rawAddress.match(/\b\d{6}\b/);
    const pincode = pincodeMatch ? pincodeMatch[0] : "";

    // 2. Clean up prefix "Ship To: "
    let cleanAddress = rawAddress.replace(/^Ship To:\s*/i, "").trim();

    // 3. Extract up to Tehsil
    // Logic: Find "Tehsil - XXXXX" and stop after that word.
    // Or closer to user request: "Address - ..., Village - ..., Tehsil - Petlawad"

    // Split by comma to check segments
    const parts = cleanAddress.split(',').map(p => p.trim());
    let addressParts = [];
    let foundTehsil = false;

    for (const part of parts) {
        // Clean "Address - " prefix from the first part if present
        let currentPart = part.replace(/^Address\s*-\s*/i, "");

        addressParts.push(currentPart);

        if (part.toLowerCase().includes("tehsil")) {
            foundTehsil = true;
            break; // Stop after adding the segment containing Tehsil
        }
    }

    // Join back with comma
    let address1 = addressParts.join(", ");

    // Fallback: if Tehsil not found, use full string but clean Pincode part if possible
    if (!foundTehsil) {
        // Remove pincode part from end if it exists in text like "..., Pincode - 457770"
        address1 = cleanAddress.replace(/,?\s*Pincode\s*-\s*\d{6}.*$/i, "");
    }

    return {
        address1: address1.substring(0, 250), // Safety truncation
        pincode: pincode
    };
}
