import nodemailer from "nodemailer";

export class MailerNotConfiguredError extends Error {}

/** メール送信に必要な接続情報（環境変数）が設定されているか */
export function isMailerConfigured(): boolean {
  return !!process.env.SMTP_USER && !!process.env.SMTP_PASSWORD;
}

/** Gmail（アプリパスワード）経由でメールを送る。サーバー側（Route Handler）専用 */
export async function sendMailWithAttachment(params: {
  to: string;
  subject: string;
  text: string;
  attachment: { filename: string; content: string; contentType: string };
}): Promise<void> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) throw new MailerNotConfiguredError("SMTP_USER / SMTP_PASSWORD が設定されていません");

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: { name: "YARURU", address: user },
    to: params.to,
    subject: params.subject,
    text: params.text,
    attachments: [params.attachment],
  });
}
