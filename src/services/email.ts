import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';

export interface WelcomeEmailParams {
  name: string;
  email: string;
  temporaryPassword: string;
  websiteUrl?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Lazy/singleton transporter
let transporterInstance: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporterInstance) {
    transporterInstance = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE, // false for 587 STARTTLS
      auth: {
        user: env.EMAIL_USER,
        // Gmail app passwords usually have 4-character blocks separated by spaces
        pass: env.EMAIL_PASSWORD.replace(/\s+/g, ''),
      },
    });
  }
  return transporterInstance;
}

export async function sendWelcomeUserEmail(params: WelcomeEmailParams): Promise<SendEmailResult> {
  const websiteUrl = (params.websiteUrl || env.FRONTEND_ORIGIN || 'http://localhost:3000').replace(/\/+$/, '');
  const fullName = params.name || 'User';
  const userEmail = params.email;
  const temporaryPassword = params.temporaryPassword;

  // Plain Text Version (Matches User Template Exactly)
  const textBody = `Hello ${fullName},

Welcome to Melosis CRM

Your account has been successfully created by the system administrator. You can now access the Melosis CRM platform using the credentials provided below.

### Your Login Credentials

**Username / Email:** ${userEmail}

**Temporary Password:** ${temporaryPassword}

**CRM Access Link:** ${websiteUrl}

### Getting Started

1. Open the CRM access link above.
2. Log in using your email address and temporary password.
3. You will be prompted to create a new password on your first login.
4. Once logged in, you can start using the CRM according to your assigned access permissions.

### Important Security Notice

- Keep your login credentials confidential.
- Do not share your password with anyone.
- Change your temporary password immediately after your first login.
- Contact your system administrator if you experience any login issues.

We are glad to have you on board!

Best regards,  
**Melosis Team**  
Melosis CRM  
${websiteUrl}
`;

  // HTML Version for Rich Modern Inboxes (Gmail, Outlook, Apple Mail)
  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Melosis CRM</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      line-height: 1.6;
    }
    .wrapper {
      width: 100%;
      background-color: #f1f5f9;
      padding: 32px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
      border: 1px solid #e2e8f0;
    }
    .header-bar {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      padding: 24px 32px;
      color: #ffffff;
    }
    .header-bar h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .header-bar p {
      margin: 4px 0 0;
      font-size: 13px;
      color: #bfdbfe;
    }
    .content {
      padding: 32px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 12px;
    }
    .lead-text {
      font-size: 14px;
      color: #334155;
      margin-bottom: 24px;
    }
    .credentials-card {
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 4px solid #2563eb;
      border-radius: 8px;
      padding: 18px 20px;
      margin-bottom: 26px;
    }
    .credentials-card h3 {
      margin: 0 0 14px;
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .cred-row {
      margin-bottom: 10px;
      font-size: 13.5px;
    }
    .cred-row:last-child {
      margin-bottom: 0;
    }
    .cred-label {
      font-weight: 600;
      color: #475569;
      display: inline-block;
      min-width: 150px;
    }
    .cred-value {
      color: #0f172a;
      font-weight: 600;
    }
    .cred-badge {
      display: inline-block;
      background-color: #e0e7ff;
      color: #3730a3;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 13px;
      letter-spacing: 0.5px;
    }
    .cta-btn-wrapper {
      text-align: center;
      margin: 28px 0;
    }
    .cta-btn {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin: 24px 0 10px;
    }
    ol, ul {
      margin: 0 0 18px;
      padding-left: 20px;
      font-size: 13.5px;
      color: #334155;
    }
    li {
      margin-bottom: 6px;
    }
    .security-box {
      background-color: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 14px 18px;
      margin-top: 24px;
    }
    .security-box h4 {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 700;
      color: #92400e;
    }
    .security-box ul {
      margin-bottom: 0;
      color: #78350f;
    }
    .footer {
      border-top: 1px solid #e2e8f0;
      padding: 20px 32px;
      background-color: #f8fafc;
      font-size: 12.5px;
      color: #64748b;
    }
    .footer p {
      margin: 4px 0;
    }
    .footer strong {
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header-bar">
        <h1>Welcome to Melosis CRM</h1>
        <p>Enterprise Customer Relationship Management</p>
      </div>
      <div class="content">
        <p class="greeting">Hello ${fullName},</p>
        <p class="lead-text">
          Your account has been successfully created by the system administrator. You can now access the Melosis CRM platform using the credentials provided below.
        </p>

        <div class="credentials-card">
          <h3>Your Login Credentials</h3>
          <div class="cred-row">
            <span class="cred-label">Username / Email:</span>
            <span class="cred-value">${userEmail}</span>
          </div>
          <div class="cred-row">
            <span class="cred-label">Temporary Password:</span>
            <span class="cred-badge">${temporaryPassword}</span>
          </div>
          <div class="cred-row">
            <span class="cred-label">CRM Access Link:</span>
            <a class="cred-value" href="${websiteUrl}" style="color: #2563eb; text-decoration: underline;">${websiteUrl}</a>
          </div>
        </div>

        <div class="cta-btn-wrapper">
          <a class="cta-btn" href="${websiteUrl}">Open Melosis CRM &rarr;</a>
        </div>

        <div class="section-title">Getting Started</div>
        <ol>
          <li>Open the CRM access link above.</li>
          <li>Log in using your email address and temporary password.</li>
          <li>You will be prompted to create a new password on your first login.</li>
          <li>Once logged in, you can start using the CRM according to your assigned access permissions.</li>
        </ol>

        <div class="security-box">
          <h4>Important Security Notice</h4>
          <ul>
            <li>Keep your login credentials confidential.</li>
            <li>Do not share your password with anyone.</li>
            <li>Change your temporary password immediately after your first login.</li>
            <li>Contact your system administrator if you experience any login issues.</li>
          </ul>
        </div>
      </div>

      <div class="footer">
        <p>We are glad to have you on board!</p>
        <p>Best regards,<br><strong>Melosis Team</strong><br>Melosis CRM &bull; <a href="${websiteUrl}" style="color: #2563eb;">${websiteUrl}</a></p>
      </div>
    </div>
  </div>
</body>
</html>
`;

  try {
    const transporter = getTransporter();
    const fromAddress = env.EMAIL_FROM_NAME
      ? `"${env.EMAIL_FROM_NAME.trim()}" <${env.EMAIL_FROM}>`
      : env.EMAIL_FROM;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: userEmail,
      subject: 'Welcome to Melosis CRM - Your Login Credentials',
      text: textBody,
      html: htmlBody,
    });

    console.log(`[Email Service] Welcome email successfully sent to ${userEmail}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Email Service] Failed to send welcome email to ${userEmail}:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}
