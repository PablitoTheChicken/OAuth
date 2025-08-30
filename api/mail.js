const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: "smtp.protonmail.ch",
  port: 465,
  secure: true,
  auth: {
    user: "joram@kleiberg.net",
    pass: "NKNAK718MWLWV9YH"
  },
  tls: {
    rejectUnauthorized: false // <-- helpful if cert issues
  }
});

router.post("/submit", async (req, res) => {
  const { name, company, email, subject, message } = req.body;

  console.log("Received contact form submission:", req.body);

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  console.log("Sending email...");

  transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP connection error:", error);
  } else {
    console.log("SMTP server is ready to send messages");
  }
});

  try {
    await transporter.sendMail({
      from: `"ForReal Business Contact Form" <joram@kleiberg.net>`, // must be your ProtonMail
      replyTo: email,
      to: "joram@kleiberg.net",
      subject: `[Contact Form] ${subject}`,
      html: `
        <p><strong>Name:</strong> ${name}</p>
        ${company ? `<p><strong>Company:</strong> ${company}</p>` : ""}
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `
    });

    res.json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

module.exports = router;