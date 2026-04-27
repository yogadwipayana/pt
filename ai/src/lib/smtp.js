import nodemailer from "nodemailer";

let cachedTransporter = null;
let cachedConfigKey = null;

function envValue(name) {
  const value = process.env[name];
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseBoolean(value, fallback = false) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePort(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getSmtpConfig() {
  const host = envValue("SMTP_HOST");
  if (!host) return null;

  const secure = parseBoolean(process.env.SMTP_SECURE, false);
  const port = parsePort(process.env.SMTP_PORT, secure ? 465 : 587);
  const fromEmail = envValue("SMTP_FROM_EMAIL") || envValue("SMTP_USER");
  const fromName = envValue("SMTP_FROM_NAME") || "Dwipa";
  const user = envValue("SMTP_USER");
  const pass = envValue("SMTP_PASS");

  if (!fromEmail) {
    throw new Error("SMTP_FROM_EMAIL or SMTP_USER must be configured.");
  }

  return {
    host,
    port,
    secure,
    fromEmail,
    fromName,
    user,
    pass,
    requireTls: parseBoolean(process.env.SMTP_REQUIRE_TLS, false),
    ignoreTls: parseBoolean(process.env.SMTP_IGNORE_TLS, false),
    allowInvalidCert: parseBoolean(process.env.SMTP_ALLOW_INVALID_CERT, false),
  };
}

function getTransporter(config) {
  const configKey = JSON.stringify({
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    pass: config.pass ? "***" : "",
    requireTls: config.requireTls,
    ignoreTls: config.ignoreTls,
    allowInvalidCert: config.allowInvalidCert,
  });

  if (cachedTransporter && cachedConfigKey === configKey) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTls,
    ignoreTLS: config.ignoreTls,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    tls: config.allowInvalidCert ? { rejectUnauthorized: false } : undefined,
  });
  cachedConfigKey = configKey;
  return cachedTransporter;
}

function formatExpiry(expiresAt) {
  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return "10 minutes";
  const minutes = Math.max(1, Math.round((expiresMs - Date.now()) / 60000));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function buildOtpEmail({ fullName, otpCode, expiresAt }) {
  const safeName = String(fullName || "").trim() || "there";
  const expiresIn = formatExpiry(expiresAt);

  return {
    subject: `Dwipa verification code: ${otpCode}`,
    text: [
      `Hi ${safeName},`,
      "",
      "Use this verification code to finish creating your Dwipa account:",
      "",
      otpCode,
      "",
      `This code expires in ${expiresIn}.`,
      "",
      "If you did not request this code, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <p>Hi ${safeName},</p>
        <p>Use this verification code to finish creating your Dwipa account:</p>
        <p style="margin:24px 0;font-size:32px;font-weight:700;letter-spacing:0.3em">${otpCode}</p>
        <p>This code expires in ${expiresIn}.</p>
        <p>If you did not request this code, you can ignore this email.</p>
      </div>
    `,
  };
}

export async function sendOtpEmail({ to, fullName, otpCode, expiresAt }) {
  const config = getSmtpConfig();
  if (!config) {
    return {
      status: "skipped",
      message: "SMTP is not configured.",
    };
  }

  const transporter = getTransporter(config);
  const email = buildOtpEmail({ fullName, otpCode, expiresAt });
  const info = await transporter.sendMail({
    from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
    to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  return {
    status: "sent",
    message: "Verification email sent.",
    messageId: info.messageId || null,
  };
}
