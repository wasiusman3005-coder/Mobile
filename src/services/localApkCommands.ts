import {
  isNativeAndroidApk,
  openInstalledAppAndroid,
  callPhoneContactAndroid,
  sendWhatsAppMessageAndroid,
  sendNativeSms,
  getNativePhoneNotifications,
  replyToPhoneNotification,
  answerOrRejectCallAndroid,
  acknowledgeVipRemindersAndroid,
  getUserActivityStateAndroid,
} from "./nativeAndroidBridge";
import { togglePhoneFlashlight } from "./mobileDeviceActions";

export interface LocalCommandResult {
  handled: boolean;
  reply?: string;
  actionExecuted?: string;
  triggerAction?: string;
  triggerPayload?: any;
}

const KNOWN_APP_KEYWORDS = [
  "whatsapp",
  "watsapp",
  "youtube",
  "chrome",
  "camera",
  "gallery",
  "photos",
  "settings",
  "setting",
  "phone",
  "dialer",
  "contacts",
  "messages",
  "sms",
  "maps",
  "map",
  "instagram",
  "insta",
  "facebook",
  "fb",
  "messenger",
  "tiktok",
  "snapchat",
  "gmail",
  "play store",
  "playstore",
  "calculator",
  "clock",
  "alarm",
  "spotify",
  "telegram",
];

// Map Urdu Nastaliq script app/action words to clean canonical English tokens
const URDU_WORD_MAP: Array<[RegExp, string]> = [
  [/واٹس\s*ایپ|وٹس\s*ایپ|واٹساپ/g, "whatsapp"],
  [/یوٹیوب|یو\s*ٹیوب/g, "youtube"],
  [/فیس\s*بک/g, "facebook"],
  [/انسٹا\s*گرام|انسٹا/g, "instagram"],
  [/ٹک\s*ٹاک/g, "tiktok"],
  [/سنیپ\s*چیٹ/g, "snapchat"],
  [/میسنجر/g, "messenger"],
  [/ٹیلی\s*گرام/g, "telegram"],
  [/کروم/g, "chrome"],
  [/کیمرہ|کیمرا/g, "camera"],
  [/گیلری/g, "gallery"],
  [/سیٹنگز|سیٹنگ/g, "settings"],
  [/کیلکولیٹر/g, "calculator"],
  [/پلے\s*سٹور/g, "play store"],
  [/جی\s*میل/g, "gmail"],
  [/میپس|نقشہ/g, "maps"],
  [/ٹارچ|فلیش\s*لائٹ|فلیش/g, "flashlight"],
  [/کال\s*کرو|کال\s*ملاؤ|کال\s*لگاؤ|فون\s*کرو|فون\s*ملاؤ|فون\s*لگاؤ|کال/g, "call"],
  [/کھولو|کھول\s*دو|اوپن\s*کرو|چلاؤ|چلا\s*دو|آن\s*کرو/g, "open"],
  [/بند\s*کرو|بند|بجھا\s*دو|آف\s*کرو/g, "off"],
  [/میسج|پیغام|مسیج/g, "message"],
  [/جواب\s*دو|جواب\s*بھیجو|ریپلائی/g, "reply"],
  [/بھیجو|سینڈ\s*کرو|لکھو/g, "bhejo"],
  [/ٹائم|وقت|بجے/g, "time"],
  [/تاریخ|آج\s*کیا\s*دن/g, "date"],
  [/السلام\s*علیکم|اسلام\s*علیکم|سلام/g, "assalam"],
  [/وال\s*پیپر|تھیم|ون\s*یو\s*آئی/g, "one ui 9"],
  [/کو/g, " ko "],
  [/پر|پہ|پے/g, " par "],
  [/کی|کا|کے/g, " "],
];

export function normalizeUrduSpeechText(raw: string): string {
  let out = raw.trim();
  for (const [rx, rep] of URDU_WORD_MAP) {
    out = out.replace(rx, ` ${rep} `);
  }
  // Common Android ASR phonetic mishearings for Urdu words
  out = out
    .replace(/\b(kholo|khol do|open karo|open kro|khalo|kholo na|chalao|chala do)\b/gi, "open")
    .replace(/\b(milan|milao|mila do|laga do|lagao|karo call|karna call)\b/gi, "call")
    .replace(/\b(whats app|what's app|watts app|watsap|watsapp|vatsapp)\b/gi, "whatsapp")
    .replace(/\b(flash light|tarch|torch light)\b/gi, "flashlight")
    .replace(/\s+/g, " ")
    .trim();
  return out;
}

/**
 * Handles direct on-device Android actions (Open App, Call Contact/Number,
 * WhatsApp Reply/Message, SMS, Flashlight, One UI 9 Studio, Greetings, Time)
 * instantaneously in <10ms across both Roman Urdu and Urdu Nastaliq script.
 */
export async function tryExecuteLocalPhoneCommand(rawText: string): Promise<LocalCommandResult> {
  const original = rawText.trim();
  if (!original) return { handled: false };

  const normalized = normalizeUrduSpeechText(original);
  const lowerOrig = original.toLowerCase();
  const lower = normalized.toLowerCase();

  // 0. Open One UI 9 Studio / Live Wallpaper / Clock / Quick Panel by voice
  if (
    lower.includes("one ui") ||
    lower.includes("oneui") ||
    lower.includes("wallpaper") ||
    lower.includes("lock design") ||
    lower.includes("clock design") ||
    lower.includes("dynamic bar") ||
    lower.includes("charging animation") ||
    lower.includes("fingerprint animation") ||
    lower.includes("theme studio")
  ) {
    return {
      handled: true,
      reply: "One UI 9 Studio khol diya gaya hai — yahan se aap live wallpapers, clock styles, dynamic bar aur shortcut designs customize kar sakte hain.",
      actionExecuted: "OPEN_ONEUI_STUDIO",
      triggerAction: "OPEN_ONEUI_STUDIO",
    };
  }

  if (
    lower.includes("quick panel") ||
    lower.includes("control center") ||
    lower.includes("shortcut switch") ||
    lower.includes("swipe panel")
  ) {
    return {
      handled: true,
      reply: "One UI 9 Quick Control Panel khol diya gaya hai.",
      actionExecuted: "OPEN_QUICK_PANEL",
      triggerAction: "OPEN_QUICK_PANEL",
    };
  }

  // 0B. Instant Flashlight Control
  if (lower.includes("flashlight") || lower.includes("torch") || lower.includes("flash")) {
    const turnOff =
      lower.includes("off") ||
      lowerOrig.includes("band") ||
      lowerOrig.includes("bujha") ||
      lowerOrig.includes("بند");
    const res = await togglePhoneFlashlight(!turnOff);
    return {
      handled: true,
      reply: res.message,
      actionExecuted: turnOff ? "FLASHLIGHT_OFF" : "FLASHLIGHT_ON",
    };
  }

  // 0C. Instant Call Answer / Reject by Voice
  if (
    lower.includes("call uthao") ||
    lower.includes("answer call") ||
    lower.includes("receive call") ||
    lower.includes("call receive") ||
    lower.includes("phone uthao") ||
    lower.includes("call attend")
  ) {
    const res = await answerOrRejectCallAndroid("answer");
    return {
      handled: true,
      reply: res.ok ? "Call receive kar li hai." : res.message,
      actionExecuted: res.ok ? "CALL_ANSWERED" : "CALL_ANSWER_NEEDS_PERM",
      triggerAction: "CALL_ANSWER",
    };
  }

  if (
    lower.includes("call kato") ||
    lower.includes("call kaato") ||
    lower.includes("reject call") ||
    lower.includes("end call") ||
    lower.includes("call band") ||
    lower.includes("decline call")
  ) {
    const res = await answerOrRejectCallAndroid("reject");
    return {
      handled: true,
      reply: res.ok ? "Call cut kar di hai." : res.message,
      actionExecuted: res.ok ? "CALL_REJECTED" : "CALL_REJECT_FAILED",
      triggerAction: "CALL_REJECT",
    };
  }

  // 0D. Acknowledge / Clear Repeating VIP & Task Reminders
  if (
    lower.includes("reminder band") ||
    lower.includes("reminders band") ||
    lower.includes("ok samajh") ||
    lower.includes("acknowledge reminder") ||
    lower.includes("stop reminding")
  ) {
    await acknowledgeVipRemindersAndroid();
    return {
      handled: true,
      reply: "Tamam active VIP aur task repeat reminders band kar diye gaye hain.",
      actionExecuted: "VIP_REMINDERS_CLEARED",
      triggerAction: "CLEAR_VIP_REMINDERS",
    };
  }

  // 0E. Current Activity / Posture Check
  if (
    lower.includes("kya kar raha") ||
    lower.includes("meri condition") ||
    lower.includes("posture batao") ||
    lower.includes("activity status")
  ) {
    const act = await getUserActivityStateAndroid();
    const label =
      act === "riding_bike"
        ? "Aap bike ya gari chala rahe hain — main alerts short aur hands-free rakhungi."
        : act === "lying_sleeping"
        ? "Aap aaraam ya sone ki haalat mein hain — sirf VIP alerts aloud bolungi."
        : act === "walking"
        ? "Aap chal phir rahe hain — voice mode active hai."
        : "Aap stationary / baithe hue hain — tamam features normal standby par hain.";
    return {
      handled: true,
      reply: label,
      actionExecuted: `ACTIVITY_${act.toUpperCase()}`,
    };
  }

  // 1. WhatsApp / App Notification Reply or Send Message
  const waSendMatch =
    normalized.match(/([^\n:]+?)\s+ko\s+(?:whatsapp|watsapp)(?:\s+(?:par|pe|per))?\s+(?:message|msg|jawab|reply)?\s*(?:bhejo|likho|karo|kro|send\s*karo|do)\s+(.+)/i) ||
    normalized.match(/(?:send\s+)?(?:a\s+)?(?:whatsapp|watsapp)\s+(?:message|msg|reply)?\s*(?:to\s+)?([^\s,:]+)\s+(?:that\s+|saying\s+)?(.+)/i) ||
    normalized.match(/(?:reply|jawab)\s+(?:to\s+)?([^\s,:]+)\s+(?:on\s+whatsapp\s+)?(?:that\s+|saying\s+)?(.+)/i) ||
    normalized.match(/([^\n:]+?)\s+ko\s+(?:whatsapp\s+)?(?:reply|jawab)\s+(?:karo|kro|bhejo|do|dein)\s+(.+)/i) ||
    normalized.match(/(.+?)\s+(?:whatsapp|message)\s+(?:bhejo|do)\s+(.+)/i);

  if (waSendMatch) {
    const target = waSendMatch[1]
      .replace(/\b(mera|mere|ko|to|on|whatsapp|par|message|msg|bhejo)\b/gi, "")
      .trim();
    const message = waSendMatch[2].trim();
    if (target && message) {
      if (!isNativeAndroidApk()) {
        return {
          handled: true,
          reply:
            "WhatsApp message ya reply directly bhejne ke liye Wasu's Jarvis Android APK install hona zaroori hai.",
          actionExecuted: "OPEN_COMMS",
          triggerAction: "OPEN_COMMS",
        };
      }

      const notifRes = await getNativePhoneNotifications();
      const matchedNotif = notifRes.notifications.find(
        (n) =>
          n.canReply &&
          (n.title.toLowerCase().includes(target.toLowerCase()) ||
            n.appName.toLowerCase().includes(target.toLowerCase()))
      );
      if (matchedNotif && !lower.includes("whatsapp")) {
        const rep = await replyToPhoneNotification(matchedNotif.key, message);
        if (rep.ok) {
          return {
            handled: true,
            reply: `${matchedNotif.appName} par ${matchedNotif.title} ko jawab bhej diya gaya: "${message}"`,
            actionExecuted: "WHATSAPP_DIRECT_REPLY",
          };
        }
      }

      const waRes = await sendWhatsAppMessageAndroid(target, message);
      return {
        handled: true,
        reply: waRes.message,
        actionExecuted: waRes.ok ? "WHATSAPP_MESSAGE_SENT" : "WHATSAPP_NEED_PERMISSION",
      };
    }
  }

  // 2. Direct SMS Command
  const smsMatch =
    normalized.match(/([^\n:]+?)\s+ko\s+sms\s+(?:bhejo|karo|kro|send\s*karo)\s+(.+)/i) ||
    normalized.match(/(?:send\s+)?sms\s+(?:to\s+)?([^\s,:]+)\s+(.+)/i);
  if (smsMatch) {
    const target = smsMatch[1].trim();
    const body = smsMatch[2].trim();
    if (target && body && isNativeAndroidApk()) {
      const smsRes = await sendNativeSms(target, body);
      return {
        handled: true,
        reply: smsRes.message,
        actionExecuted: "NATIVE_SMS_SENT",
      };
    }
  }

  // 3. Voice Call Command (supports Roman Urdu + Nastaliq normalized tokens + English)
  const isNotCallLogQuery =
    !lower.includes("call log") &&
    !lower.includes("missed call") &&
    !lower.includes("calls check") &&
    !lower.includes("calls batao") &&
    !lower.includes("recent call") &&
    !lower.includes("aakhri call");

  if (isNotCallLogQuery) {
    const callMatch =
      normalized.match(/(.+?)\s+ko\s+(?:call|phone|ring)\s*(?:karo|kro|lagao|laga\s*do|mila\s*do|milao|karen|kar\s*do)?$/i) ||
      normalized.match(/^(?:please\s+)?(?:call|dial|ring)\s+(.+)$/i) ||
      normalized.match(/(.+?)\s+call$/i);

    if (callMatch) {
      const target = callMatch[1]
        .replace(/\b(please|karo|kro|lagao|ko|par|pe|number|phone|call)\b/gi, "")
        .trim();
      if (target && target.length >= 2) {
        const callRes = await callPhoneContactAndroid(target);
        return {
          handled: true,
          reply: callRes.message,
          actionExecuted: callRes.ok ? "NATIVE_PHONE_CALL" : "CALL_PERMISSION_NEEDED",
        };
      }
    }
  }

  // 4. Open Any Installed Phone App Command
  const isInternalJarvisPanel =
    lower.includes("study hub") ||
    lower.includes("business hub") ||
    lower.includes("simulation hub") ||
    lower.includes("fazool kharchi") ||
    lower.includes("finance") ||
    lower.includes("expense") ||
    lower.includes("phone hub") ||
    lower.includes("alerts hub");

  if (!isInternalJarvisPanel) {
    const openMatch =
      normalized.match(/^(?:please\s+)?(?:open|launch|start)\s+(.+)$/i) ||
      normalized.match(/(.+?)\s+(?:open|start)$/i) ||
      original.match(/(.+?)\s+(?:kholo|khol\s*do|open\s*karo|open\s*kro|chala\s*do|chalao|start\s*karo)$/i);

    if (openMatch) {
      const candidate = openMatch[1]
        .replace(/\b(app|application|mera|meri|please|ko|open|karo|kro)\b/gi, "")
        .trim();

      const mentionsKnownPhoneApp = KNOWN_APP_KEYWORDS.some((k) =>
        candidate.toLowerCase().includes(k)
      );

      if (candidate && (isNativeAndroidApk() || mentionsKnownPhoneApp)) {
        const appRes = await openInstalledAppAndroid(candidate);
        if (appRes.ok || mentionsKnownPhoneApp) {
          return {
            handled: true,
            reply: appRes.message,
            actionExecuted: appRes.ok ? `OPENED_APP_${(appRes.appName || candidate).toUpperCase()}` : "OPEN_APP_FAILED",
          };
        }
      }
    }
  }

  // 5. Fast Local Conversational & Utility Fallbacks
  if (
    /^(assalam|salam|salaam|hello|hi|hey|hy)\b/i.test(lower) ||
    lower.includes("kaise ho") ||
    lower.includes("kaisi ho") ||
    lowerOrig.includes("کیسے ہو") ||
    lowerOrig.includes("کیسی ہو") ||
    lower.includes("how are you")
  ) {
    return {
      handled: true,
      reply: "Walaikum Assalam! Main bilkul theek hoon aur foran sun rahi hoon. Hukum karein, kis ko call karoon, WhatsApp bhejoon ya kaunsi app kholoon?",
      actionExecuted: "LOCAL_GREETING",
    };
  }

  if (
    lower.includes("time") ||
    lower.includes("waqt") ||
    lower.includes("baje") ||
    lower.includes("date") ||
    lower.includes("tarikh") ||
    lower.includes("tareekh")
  ) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long" });
    return {
      handled: true,
      reply: `Abhi waqt hai ${timeStr} aur aaj ${dateStr} hai.`,
      actionExecuted: "LOCAL_TIME_DATE",
    };
  }

  if (
    lower.includes("kaun ho") ||
    lower.includes("who are you") ||
    lower.includes("tumhara naam") ||
    lowerOrig.includes("تم کون ہو") ||
    lower.includes("your name")
  ) {
    return {
      handled: true,
      reply: "Main Wasu ki Jarvis hoon — aapki fast voice assistant. Aap mujhe WhatsApp, Calls, Apps aur One UI 9 Studio ke liye bol sakte hain.",
      actionExecuted: "LOCAL_IDENTITY",
    };
  }

  return { handled: false };
}
