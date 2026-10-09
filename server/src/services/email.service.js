import { Resend } from 'resend';
import { config } from '../config/env.js';

class EmailService {
  constructor() {
    this.resend = config.email.resendApiKey ? new Resend(config.email.resendApiKey) : null;
  }

  /**
   * Send branded password reset email via Resend
   * @param {{ to: string, name: string, resetUrl: string }} options
   * @returns {Promise<{ success: boolean, messageId?: string }>}
   */
  async sendPasswordResetEmail({ to, name, resetUrl }) {
    // If Resend API key is not configured, log a safe notice and return gracefully
    if (!this.resend || !config.email.resendApiKey) {
      console.warn(
        `[EmailService] RESEND_API_KEY is not configured. Password reset email skipped for ${to}. Reset URL generated successfully.`
      );
      return { success: true, mocked: true };
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your LuxeCart password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F7F3EE;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #171513;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #F7F3EE;
      padding: 40px 16px;
    }
    .card {
      max-width: 540px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border: 1px solid #E7DED5;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(42, 33, 27, 0.04);
    }
    .header {
      background-color: #2A211B;
      padding: 32px 24px;
      text-align: center;
    }
    .brand-title {
      color: #E7DED5;
      font-family: Georgia, serif;
      font-size: 24px;
      font-weight: bold;
      letter-spacing: 2px;
      margin: 0;
      text-transform: uppercase;
    }
    .brand-tagline {
      color: #9A6A45;
      font-size: 11px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-top: 4px;
    }
    .body {
      padding: 36px 32px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 600;
      color: #2A211B;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .text {
      font-size: 14px;
      line-height: 1.6;
      color: #6F6963;
      margin-bottom: 24px;
    }
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      background-color: #2A211B;
      color: #FFFFFF !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 14px 32px;
      border-radius: 10px;
      letter-spacing: 0.5px;
    }
    .expiry-note {
      font-size: 12px;
      color: #9A6A45;
      background-color: #F7F3EE;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 24px;
      text-align: center;
    }
    .link-fallback {
      font-size: 12px;
      color: #8C827A;
      word-break: break-all;
      margin-top: 24px;
      line-height: 1.5;
    }
    .footer {
      border-top: 1px solid #E7DED5;
      padding: 24px 32px;
      background-color: #FAF8F5;
      text-align: center;
      font-size: 12px;
      color: #8C827A;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand-title">LuxeCart</div>
        <div class="brand-tagline">Artisanal Luxury E-Commerce</div>
      </div>
      <div class="body">
        <h2 class="greeting">Hello ${name ? name.split(' ')[0] : 'there'},</h2>
        <p class="text">
          We received a request to reset your LuxeCart account password. Please click the button below to choose a new password.
        </p>
        <div class="button-container">
          <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" class="btn">Reset Password</a>
        </div>
        <div class="expiry-note">
          <strong>Note:</strong> This password reset link will expire in <strong>30 minutes</strong>.
        </div>
        <p class="text" style="margin-bottom: 0; font-size: 13px;">
          If you did not request a password reset, you can safely disregard this email. Your password will remain unchanged.
        </p>
        <div class="link-fallback">
          If the button above does not work, copy and paste this URL into your browser:<br>
          <a href="${resetUrl}" style="color: #9A6A45; text-decoration: underline;">${resetUrl}</a>
        </div>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} LuxeCart Inc. All rights reserved.<br>
        Curated Fashion & Lifestyle Essentials.
      </div>
    </div>
  </div>
</body>
</html>
    `;

    try {
      const response = await this.resend.emails.send({
        from: config.email.from,
        to,
        subject: 'Reset your LuxeCart password',
        html: htmlContent,
      });

      return {
        success: true,
        messageId: response?.data?.id || response?.id,
      };
    } catch (err) {
      console.error('[EmailService] Failed to send password reset email via Resend:', err.message);
      // We still return a resolved status so the client receives a uniform timing-safe response
      return {
        success: false,
        error: err.message,
      };
    }
  }
}

export default new EmailService();
