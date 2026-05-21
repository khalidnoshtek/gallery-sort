import path from "node:path";
import type { MediaCategory, MediaIntent } from "../db/enums";

export interface HeuristicClassification {
  category: MediaCategory;
  intent: MediaIntent;
  confidence: number;
  reasons: string[];
}

const RX_SCREENSHOT = /^(screenshot|screen\s?shot|scr_|capture_)/i;
const RX_WHATSAPP_PATH = /[\\/](whatsapp|WhatsApp)[\\/]/;
const RX_CAMERA_PATH = /[\\/](DCIM|Camera|100[A-Z]+)[\\/]/i;
const RX_DOWNLOAD_PATH = /[\\/]Downloads?[\\/]/;
const RX_TELEGRAM_PATH = /[\\/](Telegram|TelegramMedia)[\\/]/;
const RX_MEME_HINTS = /\b(meme|funny|lol|reddit|9gag)\b/i;
const RX_RECEIPT_HINTS = /\b(receipt|invoice|bill|gst|tax)\b/i;
const RX_DOC_HINTS = /\b(scan|doc|document|aadhaar|passport|pan|license)\b/i;

export function heuristicClassify(filePath: string, filename: string, ext: string): HeuristicClassification {
  const lowerName = filename.toLowerCase();
  const dir = path.dirname(filePath);
  const reasons: string[] = [];

  let category: MediaCategory = "OTHER";
  let intent: MediaIntent = "UNKNOWN";
  let confidence = 0;

  if (RX_SCREENSHOT.test(lowerName) || dir.toLowerCase().includes("screenshot")) {
    category = "SCREENSHOT";
    intent = "EPHEMERAL";
    confidence = 0.85;
    reasons.push("filename matches screenshot pattern");
  } else if (RX_WHATSAPP_PATH.test(filePath) || RX_TELEGRAM_PATH.test(filePath)) {
    category = "WHATSAPP_FORWARD";
    intent = "EPHEMERAL";
    confidence = 0.7;
    reasons.push("path contains messenger media directory");
  } else if (RX_CAMERA_PATH.test(filePath)) {
    category = "PHOTO";
    intent = "KEEP_LONG_TERM";
    confidence = 0.6;
    reasons.push("path looks like camera directory");
  } else if (RX_RECEIPT_HINTS.test(lowerName) || RX_DOC_HINTS.test(lowerName)) {
    category = RX_RECEIPT_HINTS.test(lowerName) ? "RECEIPT" : "DOCUMENT";
    intent = "EPHEMERAL";
    confidence = 0.5;
    reasons.push("filename suggests transactional content");
  } else if (RX_MEME_HINTS.test(lowerName)) {
    category = "MEME";
    intent = "EPHEMERAL";
    confidence = 0.5;
    reasons.push("filename suggests meme");
  } else if (RX_DOWNLOAD_PATH.test(filePath)) {
    intent = "EPHEMERAL";
    confidence = 0.3;
    reasons.push("file is in Downloads — likely ephemeral");
  }

  void ext;
  return { category, intent, confidence, reasons };
}
