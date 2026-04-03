// =====================================================
// File Name : whatsapp.js
// Path      : /utils/whatsapp.js
// Purpose   : Send WhatsApp alerts using Twilio
// =====================================================


import twilio from "twilio";

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

export async function sendWhatsAppAlert(message) {
    try {
        const msg = await client.messages.create({
            from: process.env.WHATSAPP_FROM,
            to: process.env.WHATSAPP_TO,
            body: message,
        });

        console.log(`📲 WhatsApp alert sent. SID: ${msg.sid}`);
    } catch (err) {
        console.log("❌ WhatsApp alert failed:", err.message);
    }
}

