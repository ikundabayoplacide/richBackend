import nodemailer from 'nodemailer';
import config from '../config/config';

// Create a reusable transporter object using the default SMTP transport, for production and development
const createTransporter = async () => {
  console.log('Creating transporter...', {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      logger: true,    // enables console logging
      debug: true,     // show SMTP traffic
    });
};

/**
 * Send a password reset email with the given reset code
 * @param to Recipient email address
 * @param resetCode The password reset code
 */
export const sendPasswordResetEmail = async (to: string, resetCode: string): Promise<void> => {
  try {
    const transporter = await createTransporter();
    const resetLink = `${config.frontendUrl}/auth/reset-password?token=${encodeURIComponent(resetCode)}`;

    // Send mail with defined transport object
    const info = await transporter.sendMail({
      from: '"RICH Ubuzima" <info@richubuzima.rw>',
      to,
      subject: 'Password Reset Request',
      text: `Please click the following link to reset your password: ${resetLink}\n\nIf the link doesn't work, please copy and paste it into your browser.\n\nThis link will expire in 1 hour.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Click the button below to reset your password:</p>
          <a href="${resetLink}" 
             style="display: inline-block; background: #004f64; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 4px; margin: 16px 0;">
            Reset Password
          </a>
          <p>If the button doesn't work, please copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666; font-size: 14px;">
            ${resetLink}
          </p>
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
          <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    // Log email preview URL in development
    if (config.nodeEnv !== 'production') {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    console.error('Error sending password reset email:', error);
    // Don't throw the error to prevent exposing email sending issues to the client
  }
};

/**
 * Send a welcome email to new users
 * @param to Recipient email address
 * @param name User's name
 */
export const sendWelcomeEmail = async (to: string, name: string): Promise<void> => {
  try {
    const transporter = await createTransporter();

    // Send mail with defined transport object
    const info = await transporter.sendMail({
      from: '"RICH Ubuzima" <info@richubuzima.rw>',
      to,
      subject: 'Welcome to Community Tool!',
      text: `Welcome ${name}!\n\nThank you for joining our community.`,
      html: `
        <div>
          <h2>Welcome to Community Tool, ${name}!</h2>
          <p>We're excited to have you on board.</p>
          <p>Start exploring the platform and connect with your community.</p>
        </div>
      `,
    });

    // Log email preview URL in development
    if (config.nodeEnv !== 'production') {
      console.log('Welcome email preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw the error to prevent exposing email sending issues to the client
  }
};

/**
 * Send an organization invite email with signup link
 */
export const sendOrganizationInviteEmail = async (
  to: string,
  ownerName: string,
  plainPassword: string,
  organizationId: string
): Promise<boolean> => {
  
  try {
    const transporter = await createTransporter();
    
    const loginLink = `${config.frontendUrl}/auth/login`;
    const mailOptions = {
      from: '"RICH Ubuzima" <info@richubuzima.rw>',
      to,
      subject: `RICH-Community Listening Tool`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Welcome ${ownerName}!</h2>
          
          <p>Your Partner account has been created successfully.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Username/Email:</strong> ${to}</p>
            <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background-color: #e0e0e0; padding: 2px 6px; border-radius: 3px;">${plainPassword}</code></p>
          </div>
          
          <p style="color: #d32f2f; font-weight: bold;">⚠️ Important: Please change your password after your first login for security.</p>
          
          <a href="${loginLink}" 
             style="display: inline-block; background: #004f64; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 4px; margin: 16px 0; font-weight: bold;">
            Login Now
          </a>
        </div>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ [Email Service] Email sent successfully! Message ID:', result.messageId);
    
    // Log email preview URL in development
    if (config.nodeEnv !== 'production') {
      const previewUrl = nodemailer.getTestMessageUrl(result);
      console.log('📧 [Email Service] Preview URL:', previewUrl);
    }
    
    return true;
  } catch (error) {
    console.error('❌ [Email Service] Error sending email:', error);
    console.error('❌ [Email Service] Error message:', (error as any).message);
    console.error('❌ [Email Service] Error code:', (error as any).code);
    return false;
  }
};

// Email templates
export const EmailTemplates = {
  ORGANIZATION_INVITE: (data: {
    organizationName: string;
    verificationLink: string;
    expiresIn: string;
  }) => ({
    subject: `Invitation to join ${data.organizationName}`,
    html: `
      <h1>Welcome to ${data.organizationName}</h1>
      <p>You have been invited to join the organization as an owner/administrator.</p>
      <p>Please click the link below to set up your account:</p>
      <a href="${data.verificationLink}" style="
        display: inline-block;
        padding: 10px 20px;
        background-color: #0066cc;
        color: white;
        text-decoration: none;
        border-radius: 5px;
      ">Set Up Account</a>
      <p>This link will expire in ${data.expiresIn}.</p>
      <p>If you did not expect this invitation, please ignore this email.</p>
    `,
  }),
};

/**
 * Send organization invite email
 */
export const sendOrganizationInvite = async (
  email: string,
  organizationName: string,
  verificationLink: string,
  expiresIn: string
): Promise<boolean> => {
  try {
    const template = EmailTemplates.ORGANIZATION_INVITE({
      organizationName,
      verificationLink,
      expiresIn,
    });
    const transporter = await createTransporter();

    await transporter.sendMail({
      from: '"RICH Ubuzima" <info@richubuzima.rw>',
      to: email,
      subject: template.subject,
      html: template.html,
      tls: {
        rejectUnauthorized: false, // <--- allow self-signed certs if needed
      },
    });
    return true;
  } catch (error) {
    console.error('Failed to send organization invite:', error);
    return false;
  }
};

// Notify a user that their feedback received a reply
export const sendFeedbackReplyEmail = async (
  to: string,
  data: { subject?: string | null; message: string; link: string }
): Promise<boolean> => {
  try {
    const transporter = await createTransporter();

    const emailSubject = data.subject && data.subject.trim().length > 0
      ? `New reply: ${data.subject}`
      : 'Your feedback has a new reply';

    const info = await transporter.sendMail({
      from: '"RICH Ubuzima" <info@richubuzima.rw>',
      to,
      subject: emailSubject,
      text: `Hello,
      You have received a new reply to your feedback.

      Subject: ${data.subject ?? '—'}
      Message:
      ${data.message}

      View reply: ${data.link}

      Regards,
      RICH Ubuzima`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2 style="margin: 0 0 12px 0;">Your feedback has a new reply</h2>
          ${data.subject ? `<p><strong>Subject:</strong> ${data.subject}</p>` : ''}
          <div style="background:#f6f7f9; border:1px solid #e5e7eb; padding:12px 16px; border-radius:6px; white-space:pre-wrap;">${data.message}</div>
          <p style="margin-top:16px;">
            <a href="${data.link}" style="display:inline-block; background:#004f64; color:#fff; padding:10px 16px; text-decoration:none; border-radius:6px;">View reply</a>
          </p>
        </div>
      `,
    });

    if (config.nodeEnv !== 'production') {
      console.log('Feedback reply email preview URL: %s', nodemailer.getTestMessageUrl(info));
    }

    return true;
  } catch (error) {
    console.error('Error sending feedback reply email:', error);
    return false;
  }
};
