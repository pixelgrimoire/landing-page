import nodemailer from 'nodemailer';

export type EmailResult = { ok: true } | { ok: false; error: string };

export async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'no-reply@localhost';
  if (!host || !port || !user || !pass) {
    console.warn('[email] SMTP not configured');
    return { ok: false, error: 'SMTP not configured' };
  }
  const transport = nodemailer.createTransport({ host, port, auth: { user, pass } });
  await transport.sendMail({ from, to, subject, html });
  return { ok: true };
}

