import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs) => twMerge(clsx(inputs));

const DATE_LOCALE = "en-GB";
const SHORT_DATE_FORMAT = {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
};

export const formatDate = (value, options = {}) =>
  new Intl.DateTimeFormat(DATE_LOCALE, {
    ...SHORT_DATE_FORMAT,
    ...options,
  }).format(new Date(value));

export const formatDateTime = (value, options = {}) => {
  if (!value) {
    return "Not started";
  }

  return new Intl.DateTimeFormat(DATE_LOCALE, {
    ...SHORT_DATE_FORMAT,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  }).format(new Date(value));
};

export const formatTime = (value, options = {}) => {
  if (!value) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...options,
  }).format(new Date(value));
};

export const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
