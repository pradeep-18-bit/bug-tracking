const mongoose = require("mongoose");

const { Schema, model, models } = mongoose;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ipv4Regex =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
const hostnameRegex =
  /^(?=.{1,253}$)(?:localhost|(?:(?!-)[a-z0-9-]{1,63}(?<!-)\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59}))$/i;

const normalizeSmtpHost = (value = "") =>
  String(value || "").replace(/\r?\n/g, "").trim().toLowerCase();

const userEmailConfigSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    workspaceId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    host: {
      type: String,
      required: true,
      set: normalizeSmtpHost,
      validate: {
        validator: (value) =>
          Boolean(
            value &&
              (hostnameRegex.test(normalizeSmtpHost(value)) ||
                ipv4Regex.test(normalizeSmtpHost(value)))
          ),
        message: "SMTP host must be a valid hostname or IPv4 address",
      },
    },
    port: {
      type: Number,
      required: true,
      min: 1,
      max: 65535,
    },
    secure: {
      type: Boolean,
      default: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [emailRegex, "SMTP username must be a valid email address"],
    },
    passwordEncrypted: {
      type: String,
      required: true,
      select: false,
    },
    fromName: {
      type: String,
      required: true,
      trim: true,
    },
    fromEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [emailRegex, "From email must be a valid email address"],
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

userEmailConfigSchema.index(
  {
    workspaceId: 1,
    userId: 1,
  },
  {
    unique: true,
  }
);

module.exports =
  models.UserEmailConfig || model("UserEmailConfig", userEmailConfigSchema);
