const pool = require("../db");
const {
    generateInvoicePdfBuffer,
    formatDateIST,
    serviceLabelFor,
    inr,
} = require("../util/invoice");
const { sendMail } = require("../util/sendMail");
const fs = require("fs");
const path = require("path");

const invoiceTemplatePath = path.join(
    __dirname,
    "..",
    "invoice",
    "Updated Invoice.pdf",
);

let invoiceTemplateBytes = null;
if (fs.existsSync(invoiceTemplatePath)) {
    invoiceTemplateBytes = fs.readFileSync(invoiceTemplatePath);
}

async function generateAndSendInvoiceForOrder(orderId) {
    try {
        // a) fetch premium row
        const premRes = await pool.query(
            `SELECT premium_id, user_id, dates, amount, currency,
              is_featured_profile, is_search_preference,
              is_premium_banner, is_trending_banner, order_id
       FROM premium
       WHERE order_id = $1
       LIMIT 1`,
            [orderId],
        );

        const premiumRow = premRes.rows[0];
        if (!premiumRow) {
            console.warn("Invoice: premium not found for order_id", orderId);
            return;
        }

        // b) fetch user details
        const userRes = await pool.query(
            `SELECT 
          u.firstname,
          u.email,
          u.mobile_number,
          d.legal_business_name,
          d.headquarters
       FROM users u
       LEFT JOIN data_collection d ON d.user_id = u.user_id
       WHERE u.user_id = $1
       LIMIT 1`,
            [premiumRow.user_id],
        );

        const user = userRes.rows[0] || {};
        user.name = user.firstname || "User";
        user.mobile = user.mobile_number || "-";

        const hq =
            user.headquarters && user.headquarters.trim()
                ? user.headquarters
                : "India";
        user.address = user.legal_business_name || "";
        user.headquarters = hq;

        // if (!invoiceTemplateBytes) {
        //     console.warn(
        //         "Invoice template missing, cannot generate invoice for",
        //         orderId
        //     );
        //     return;
        // }
        // invoice.service.js
        if (!invoiceTemplateBytes) throw new Error("Invoice template missing");

        // c) build invoice PDF
        const pdfBuffer = await generateInvoicePdfBuffer({
            templateBytes: invoiceTemplateBytes,
            premium: premiumRow,
            user,
        });

        if (!pdfBuffer || !pdfBuffer.length) {
            console.warn("Invoice PDF generated empty for order:", orderId);
            return;
        }

        if (!user.email) {
            console.warn(
                "No user email; skipping invoice email for user:",
                premiumRow.user_id,
            );
            return;
        }

        // d) Compose email
        const service = serviceLabelFor(premiumRow);
        const dates = Array.isArray(premiumRow.dates)
            ? premiumRow.dates.slice()
            : [];
        const sorted = dates
            .map((d) => new Date(d))
            .filter((dt) => !isNaN(dt))
            .sort((a, b) => a - b);

        const startDate = sorted[0] ? formatDateIST(sorted[0]) : "-";
        const endDate = sorted[sorted.length - 1]
            ? formatDateIST(sorted[sorted.length - 1])
            : "-";
        const paymentValue = `₹${inr(premiumRow.amount)}`;

        const htmlBody = `
      <div style="font-family: Arial, sans-serif; color: #222; line-height:1.6; max-width:650px;">
        <p style="margin:0 0 10px 0;">Dear <strong>${
            user.name || "Customer"
        }</strong>,</p>

        <p>We’re happy to inform you that your transaction has been successfully completed!</p>

        <p>The following service will remain visible for the selected period as per your payment details:</p>

        <h3 style="margin-top:20px; margin-bottom:8px;">Service Details:</h3>
        <ul style="list-style: disc; margin-left:20px;">
          <li><strong>Service:</strong> ${service}</li>
          <li><strong>Active From:</strong> ${startDate}, 12:00 AM</li>
          <li><strong>Active Till:</strong> ${endDate}, 11:59 PM</li>
          <li><strong>Amount:</strong> ${paymentValue}</li>
        </ul>

        <p>Your selected service is now successfully activated and will be prominently displayed on the Biznex platform for your communityduring the active period.</p>

        <p>Please find the Invoice attached for your records.</p>

        <p>If you have any questions or need assistance, feel free to reach out to us at <a href="mailto:support@niftrix.com">support@niftrix.com</a>.</p>

        <p style="margin-top:25px;">
          Warm Regards,<br/>
          <strong>Team Biznex</strong><br/>
          <a href="https://biznex.niftrix.com" style="color:#0078d7;">https://biznex.niftrix.com</a>
        </p>
      </div>`;

        // e) Send to user
        await sendMail({
            to: user.email,
            subject: "Payment Confirmation & Service Activation – Biznex",
            html: htmlBody,
            attachments: [
                {
                    filename: "Invoice.pdf",
                    content: pdfBuffer,
                    contentType: "application/pdf",
                },
            ],
        });
        console.log("Invoice email sent ✅ to", user.email);

        // f) Send copy to admin
        const invoiceNo = `RB${String(premiumRow.premium_id).padStart(6, "0")}`;
        const adminSubject = `Invoice of ${user.name}, invoice number ${invoiceNo}`;

        await sendMail({
            to: "admin@niftrix.com",
            subject: adminSubject,
            html: `
        <p>Hi Admin,</p>
        <p>An invoice has been sent to <strong>${
            user.name || "Customer"
        }</strong> (${user.email}).</p>
        <p><strong>Invoice No:</strong> ${invoiceNo}</p>
        <p><strong>Order ID:</strong> ${premiumRow.order_id}</p>
        <p>Amount: ₹${inr(premiumRow.amount)}</p>
        <p>Attached below is the same invoice PDF.</p>
      `,
            attachments: [
                {
                    filename: "Invoice.pdf",
                    content: pdfBuffer,
                    contentType: "application/pdf",
                },
            ],
        });
        console.log("Admin copy sent ✅ to admin@niftrix.com");
    } catch (err) {
        console.error("Invoice block error for order", orderId, ":", err);
    }
}

module.exports = {
    generateAndSendInvoiceForOrder,
};
