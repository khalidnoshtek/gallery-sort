import type { MediaCategory, MediaIntent } from "../db/enums";

export interface HeuristicClassification {
  category: MediaCategory;
  intent: MediaIntent;
  confidence: number;
}

const RX_SCREENSHOT = /^(screenshot|screen\s?shot|scr_|capture_)/i;
const RX_WHATSAPP_PATH = /(?:^|\/)(whatsapp|WhatsApp)\//;
const RX_TELEGRAM_PATH = /(?:^|\/)(Telegram|TelegramMedia)\//;
const RX_CAMERA_PATH = /(?:^|\/)(DCIM|Camera|100[A-Z]+)\//i;
const RX_DOWNLOAD_PATH = /(?:^|\/)Downloads?\//;
const RX_MEME_HINTS = /\b(meme|funny|lol|reddit|9gag)\b/i;
const RX_RECEIPT_HINTS = /\b(receipt|invoice|bill|gst|tax)\b/i;
const RX_DOC_HINTS = /\b(scan|doc|document|aadhaar|passport|pan|license)\b/i;
const RX_WA_FILENAME = /^IMG-\d{8}-WA\d+/i;

export function classifyByPath(relativePath: string): HeuristicClassification {
  const filename = relativePath.split("/").pop() ?? relativePath;
  const lower = filename.toLowerCase();

  if (RX_SCREENSHOT.test(lower) || /\/screenshots?\//i.test(relativePath)) {
    return { category: "SCREENSHOT", intent: "EPHEMERAL", confidence: 0.85 };
  }
  if (RX_WHATSAPP_PATH.test(relativePath) || RX_WA_FILENAME.test(filename) || RX_TELEGRAM_PATH.test(relativePath)) {
    return { category: "WHATSAPP_FORWARD", intent: "EPHEMERAL", confidence: 0.75 };
  }
  if (RX_RECEIPT_HINTS.test(lower)) {
    return { category: "RECEIPT", intent: "EPHEMERAL", confidence: 0.5 };
  }
  if (RX_DOC_HINTS.test(lower)) {
    return { category: "DOCUMENT", intent: "EPHEMERAL", confidence: 0.5 };
  }
  if (RX_MEME_HINTS.test(lower)) {
    return { category: "MEME", intent: "EPHEMERAL", confidence: 0.5 };
  }
  if (RX_CAMERA_PATH.test(relativePath)) {
    return { category: "PHOTO", intent: "KEEP_LONG_TERM", confidence: 0.6 };
  }
  if (RX_DOWNLOAD_PATH.test(relativePath)) {
    return { category: "OTHER", intent: "EPHEMERAL", confidence: 0.3 };
  }
  return { category: "OTHER", intent: "UNKNOWN", confidence: 0.0 };
}
