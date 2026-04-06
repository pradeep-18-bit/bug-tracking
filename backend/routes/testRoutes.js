const express = require("express");
const { sendIssueEmail } = require("../services/emailService");

const router = express.Router();

router.get("/test-email", async (req, res) => {
  try {
    const testIssue = {
      title: "Test Issue",
      description: "Testing email system",
      projectName: "Test Project",
      assigneeName: "Test User",
      priority: "Medium",
      status: "TO_DO",
      createdAt: new Date(),
      dueDate: new Date(),
      _id: "123456",
    };

    const emails = ["akurathipradeep14@gmail.com"];

    console.log("[test-email] Sending test email...");
    await sendIssueEmail(emails, testIssue);
    console.log("[test-email] Test email sent");

    res.send("Email sent successfully");
  } catch (err) {
    console.error("[test-email] Email failed:", err);
    res.status(500).send(err.message);
  }
});

module.exports = router;
