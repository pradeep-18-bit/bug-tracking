const crypto = require("crypto");

const ENCRYPTION_PREFIX = "enc";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_IV_BYTES = 12;

const getEncryptionSecret = () =>
  String(process.env.EMAIL_CONFIG_SECRET || process.env.JWT_SECRET || "").trim();

const getEncryptionKey = () => {
  const secret = getEncryptionSecret();

  if (!secret) {
    throw new Error(
      "EMAIL_CONFIG_SECRET or JWT_SECRET must be configured to protect SMTP passwords"
    );
  }

  return crypto.createHash("sha256").update(secret).digest();
};

const encryptSecret = (value) => {
  const normalizedValue = String(value || "");

  if (!normalizedValue) {
    return "";
  }

  const iv = crypto.randomBytes(ENCRYPTION_IV_BYTES);
  const cipher = crypto.createCipheriv(
    ENCRYPTION_ALGORITHM,
    getEncryptionKey(),
    iv
  );
  const encryptedBuffer = Buffer.concat([
    cipher.update(normalizedValue, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_PREFIX,
    iv.toString("base64"),
    authTag.toString("base64"),
    encryptedBuffer.toString("base64"),
  ].join(":");
};

const decryptSecret = (payload) => {
  const normalizedPayload = String(payload || "").trim();

  if (!normalizedPayload) {
    return "";
  }

  if (!normalizedPayload.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return normalizedPayload;
  }

  const [, ivEncoded, authTagEncoded, encryptedEncoded] =
    normalizedPayload.split(":");

  if (!ivEncoded || !authTagEncoded || !encryptedEncoded) {
    throw new Error("Encrypted SMTP password is malformed");
  }

  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivEncoded, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTagEncoded, "base64"));

  const decryptedBuffer = Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, "base64")),
    decipher.final(),
  ]);

  return decryptedBuffer.toString("utf8");
};

module.exports = {
  encryptSecret,
  decryptSecret,
};
