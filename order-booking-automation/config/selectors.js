// =====================================================
// File Name : selectors.js
// Project   : Order Booking Automation (Farmkart)
// Author    : Abhishek Nimade
// Purpose   : Central place for all UI selectors
//            (easy maintenance & stability)
// =====================================================

// FARMKART LOGIN
export const FARMKART_SELECTORS = {
    usernameInput: 'input[name="username"], input[type="text"]',
    passwordInput: 'input[name="password"], input[type="password"]',
    loginButton: 'button[type="submit"], input[type="submit"]'
};

// FARMKART INVOICE PAGE
export const INVOICE_SELECTORS = {
    productTable: 'table',
    productRows: 'table tr',
};
