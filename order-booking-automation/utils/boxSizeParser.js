// =====================================================
// File Name : boxSizeParser.js
// Project   : Order Booking Automation (Farmkart)
// Author    : Abhishek Nimade
// Purpose   :
//  - Read box size from Google Sheet (Column G)
//  - Validate format: "L W H" (e.g. 18 10 10)
//  - Return structured box dimensions for automation
// =====================================================

/**
 * Parse box size string from Google Sheet
 * Expected format: "18 10 10"
 *
 * @param {string} boxSizeStr - Raw value from sheet (Column G)
 * @returns {Object|null} Parsed box size or null if invalid
 */
export function parseBoxSize(boxSizeStr) {
    if (!boxSizeStr) {
        return null;
    }

    // Convert to string & trim
    const cleaned = boxSizeStr.toString().trim();

    // Split by spaces (handles multiple spaces too)
    const parts = cleaned.split(/\s+/);

    // Must have exactly 3 values: L W H
    if (parts.length !== 3) {
        return null;
    }

    const [length, width, height] = parts.map(Number);

    // Validate numeric & positive values
    if (
        Number.isNaN(length) ||
        Number.isNaN(width) ||
        Number.isNaN(height) ||
        length <= 0 ||
        width <= 0 ||
        height <= 0
    ) {
        return null;
    }

    return {
        length,               // e.g. 18
        width,                // e.g. 10
        height,               // e.g. 10
        label: `${length} x ${width} x ${height}`, // readable format
    };
}
