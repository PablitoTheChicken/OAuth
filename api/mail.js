const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");

const router = express.Router();

const transporter = nodemailer.createTransport({
  host: "smtp.protonmail.ch",
  port: 587,
  secure: false,
  auth: {
    user: "joram@kleiberg.net",
    pass: "NKNAK718MWLWV9YH"
  }
});

router.post("/submit", async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    await transporter.sendMail({
      from: `"${name}" <${email}>`,
      to: process.env.SMTP_USER, // your ProtonMail inbox
      subject: "New Contact Form Submission",
      text: message,
      html: `<p><strong>Name:</strong> ${name}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Message:</strong><br>${message}</p>`
    });

    res.json({ success: true, message: "Email sent successfully!" });
  } catch (error) {
    console.error("Email sending error:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

module.exports = router;