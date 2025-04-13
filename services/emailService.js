import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();
// **Email and password from environment variables**
const email = process.env.EMAIL;
const pass = process.env.EMAIL_PASS;

// **Create the transporter**
export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: email,
    pass: pass,
  },
});

// **Reusable sendEmail function**
export const sendEmail = async (to, subject, message) => {
  try {
    const mailOptions = {
      from: email, // Sender's email
      to: to, // Recipient's email (can be dynamic)
      subject: subject, // Email subject
      html: message, // HTML content
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.response}`);
    return { success: true, message: 'Email sent successfully!' };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, message: error.message };
  }
};
