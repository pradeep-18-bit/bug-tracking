const express = require("express");
const { sendTestEmail } = require("../services/emailService");

const router = express.Router();

router.get("/test-email", async (req, res) => {
  try {
    const requestedRecipient = String(req.query.to || "").trim();
    const workspaceId = String(req.query.workspaceId || "").trim();
    const defaultRecipient = String(process.env.EMAIL_USER || "").trim();
    const recipient = requestedRecipient || defaultRecipient;

    if (!recipient) {
      throw new Error("Set EMAIL_USER or pass ?to=<email> to send a test email");
    }

    console.log(`[test-email] Sending test email to ${recipient}...`);
    await sendTestEmail({
      to: recipient,
      workspaceId,
    });
    console.log("[test-email] Test email sent");

    res.send("Email sent successfully");
  } catch (err) {
    console.error("[test-email] Email failed:", err);
    res.status(500).send(err.message);
  }
});

module.exports = router;
