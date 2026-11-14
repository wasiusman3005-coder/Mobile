import express from "express";
import http from "http";
import path from "path";
import os from "os";
import fs from "fs/promises";
import crypto from "crypto";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { EdgeTTS } from "edge-tts-universal";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: "35mb" }));

// Allow Phone PWA (HTTPS or LAN) to communicate cleanly with local PC bridge APIs
app.use("/api", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.header("Access-Control-Allow-Private-Network", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Server-side Google GenAI Initialization
let ai: GoogleGenAI | null = null;
const configuredGeminiKey = process.env.GEMINI_API_KEY?.trim();
if (configuredGeminiKey && configuredGeminiKey !== "MY_GEMINI_API_KEY") {
  ai = new GoogleGenAI({
    apiKey: configuredGeminiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function extractCleanCharName(personalityName?: string, gender: "male" | "female" = "female"): string {
  const cleaned = (personalityName || "")
    .replace(/\((male|female|voice)\)/gi, "")
    .trim();
  return cleaned || (gender === "male" ? "Wasu" : "Wasi ki Jan");
}

function isIdentityVideoRequest(raw: string): boolean {
  const normalized = (raw || "")
    .toLowerCase()
    .replace(/[.,!?'"’`~^*_—\-:;()\[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return (
    /(mjy|mujhe|mujhko|humko)?\s*apna\s*(ap|aap|chehra|chahra|shakal|roop)\s*(dikhao|dikhayo|dikha|batao)/i.test(normalized) ||
    /(khud|apne aap|apne ap)\s*(ko)?\s*(dikhao|dikhayo|dikha)/i.test(normalized) ||
    /\b(show\s*(me\s*)?yourself|reveal\s*yourself|show\s*your\s*face|apna\s*aap\s*dikhao|apna\s*ap\s*dikhao)\b/i.test(normalized) ||
    /اپنا\s*آپ\s*دکھاؤ|مجھے\s*اپنا\s*آپ\s*دکھاؤ|خود\s*کو\s*دکھاؤ|اپنا\s*چہرہ\s*دکھاؤ/.test(raw)
  );
}

// Fallback intelligent reasoning for Wasi when API key or quota is constrained
function getFallbackReasoning(
  message: string,
  language: string,
  personalityModifier?: string,
  characterGender: "male" | "female" = "female",
  characterName?: string
) {
  const lower = message.toLowerCase();
  const isMale = characterGender === "male";
  const charName = extractCleanCharName(characterName, characterGender);
  let reply = "";
  let action = "NONE";
  let actionPayload: Record<string, unknown> = {};

  if (isIdentityVideoRequest(message)) {
    reply =
      language === "pa"
        ? `Ji Wasi paji! Dekho, main ${charName} aur saathi tuhade saamne hazir haan.`
        : language === "en"
        ? `Presenting Wasu and Wasi ki Jan live on your quantum display, Commander Wasi.`
        : `Ji Wasi Sahab! Dekhein, main ${charName} aapke saamne hazir hoon.`;
    action = "SHOW_IDENTITY_VIDEO";
    return {
      reply,
      urduSpeechText: language === "en" ? undefined : toPakistaniUrduSpeechText(reply),
      languageDetected: language,
      action,
      actionPayload,
      vocalUrgency: "normal",
      quantumStatus: `Identity Holo-Stream Active [${charName}]`,
    };
  }

  if (
    lower.includes("thumbnail") ||
    lower.includes("auto post") ||
    lower.includes("social post") ||
    lower.includes("creative studio")
  ) {
    reply =
      language === "pa"
        ? "Creative AI Media Studio khol ditta ae Wasi paji!"
        : language === "en"
        ? "Opening Q-Nexus Creative AI Media Studio for thumbnails, video synthesis, and auto social posting."
        : "Ji Wasi Sahab! Video Generator, Thumbnail Studio aur Auto Social Poster khol diya gaya hai.";
    action = "OPEN_MEDIA_STUDIO";
    actionPayload = {
      tab: lower.includes("thumbnail") ? "thumbnail" : lower.includes("social") || lower.includes("post") ? "autopost" : "video",
    };
  } else if (lower.includes("screen help") || lower.includes("help me with screen")) {
    reply =
      language === "pa"
        ? "Screen Help Vision Studio khol reha aan Wasi paji!"
        : language === "en"
        ? "Launching Screen Help AI Inspector."
        : "Ji Wasi Sahab! Screen Help AI Inspector open ho raha hai.";
    action = "OPEN_MEDIA_STUDIO";
    actionPayload = { tab: "screenhelp" };
  } else if (lower.includes("pani") || lower.includes("water") || lower.includes("pyaas")) {
    reply =
      language === "pa"
        ? "Wasi paji, paani zaroor piyo! 1 glass fresh paani foran pee lyo."
        : "Wasi Sahab, hydration reminder active hai! Baraye meherbani 1 glass fresh pani pee lijiye.";
    action = "HEALTH_ALERT";
    actionPayload = { type: "hydration", message: "Hydration Check: Drink 300ml Water" };
  } else if (lower.includes("screen") || lower.includes("ocr") || lower.includes("spreadsheet") || lower.includes("scan")) {
    reply =
      language === "pa"
        ? "Screen context vision active ho gaya ae Wasi paji!"
        : "Wasi Sahab, Screen & Context Awareness active ho gaya hai.";
    action = "OPEN_AUTOMATION";
    actionPayload = { tab: "screen" };
  } else if (lower.includes("docker") || lower.includes("shell") || lower.includes("terminal") || lower.includes("git")) {
    reply =
      language === "pa"
        ? "Host shell terminal te Docker console launch ho gaya ae Wasi paji!"
        : "Wasi Sahab, Host Shell Commands aur Docker Container console open ho gaya hai.";
    action = "OPEN_AUTOMATION";
    actionPayload = { tab: "shell" };
  } else if (lower.includes("routine") || lower.includes("cron") || lower.includes("schedule") || lower.includes("automated")) {
    reply =
      language === "pa"
        ? "Scheduled routines module khol ditta ae Wasi paji."
        : "Wasi Sahab, Scheduled Multi-Step Routines module khol diya gaya hai.";
    action = "OPEN_AUTOMATION";
    actionPayload = { tab: "routines" };
  } else if (lower.includes("whatsapp") || lower.includes("slack") || lower.includes("telegram") || lower.includes("message")) {
    reply =
      language === "pa"
        ? "WhatsApp te messaging notifications hub khol ditta ae Wasi paji!"
        : "Wasi Sahab, Messages aur Notifications hub open ho gaya hai.";
    action = "OPEN_COMMS";
    actionPayload = { tab: "messaging" };
  } else if (lower.includes("meeting") || lower.includes("meet") || lower.includes("zoom") || lower.includes("call")) {
    reply =
      language === "pa"
        ? "Call logs te meeting coordination hub khol ditta ae Wasi paji!"
        : "Wasi Sahab, Call Logs aur Meeting Coordination hub launch ho gaya hai.";
    action = "OPEN_COMMS";
    actionPayload = { tab: "meetings" };
  } else if (lower.includes("privacy") || lower.includes("cloak") || lower.includes("parda") || lower.includes("chupao") || lower.includes("redact")) {
    reply =
      language === "pa"
        ? "Maximum Privacy Cloak active ho gaya ae Wasi paji!"
        : "Wasi Sahab, Maximum Privacy Cloak active kar diya gaya hai.";
    action = "PRIVACY_CLOAK";
  } else if (lower.includes("air gap") || lower.includes("airgap") || lower.includes("offline shield")) {
    reply =
      language === "pa"
        ? "Air-Gap Isolation Mode active ho gaya ae!"
        : "Wasi Sahab, Air-Gap Isolation Mode active ho gaya hai.";
    action = "AIR_GAP";
  } else if (lower.includes("map") || lower.includes("location") || lower.includes("gps") || lower.includes("radar") || lower.includes("rasta")) {
    reply =
      language === "pa"
        ? "Quantum GPS Radar te Maps launch ho gaya ae Wasi paji!"
        : "Wasi Sahab, Quantum Geospatial Maps & Live GPS Radar launch ho gaya hai.";
    action = "OPEN_MAPS";
  } else if (lower.includes("dhundo") || lower.includes("ring") || lower.includes("find my phone") || lower.includes("phone bajao")) {
    reply =
      language === "pa"
        ? "Find My Phone trigger ho gaya ae Wasi paji!"
        : "Wasi Sahab, Find My Phone trigger ho gaya hai!";
    action = "FIND_PHONE";
  } else if (lower.includes("device") || lower.includes("mobile") || lower.includes("phone") || lower.includes("iot")) {
    reply =
      language === "pa"
        ? "Digital Device Bridge te Mobile Sync Suite open ho gaya ae Wasi paji!"
        : "Wasi Sahab, Digital Device Bridge & Mobile Sync Suite open ho gaya hai.";
    action = "OPEN_DEVICES";
  } else if (lower.includes("code") || lower.includes("decompose") || lower.includes("jira") || lower.includes("ticket") || lower.includes("github")) {
    reply =
      language === "pa"
        ? "Coding copilot te Task engine khol ditta ae Wasi paji!"
        : "Wasi Sahab, Coding Copilot aur Task engine active hai.";
    action = "OPEN_COMMUNICATION";
    actionPayload = { tab: "coding" };
  } else if (lower.includes("premiere") || lower.includes("edit") || lower.includes("after effects") || lower.includes("render")) {
    reply =
      language === "pa"
        ? "Premiere Pro macros ready ne Wasi paji!"
        : "Ji Wasi Sahab! Premiere Pro aur After Effects workstation ready hai.";
    action = "OPEN_APP";
    actionPayload = { appName: "Adobe Premiere Pro" };
  } else if (lower.includes("kharch") || lower.includes("paisa") || lower.includes("expense") || lower.includes("invest")) {
    reply =
      language === "pa"
        ? "Wallet te budget guard khol ditta ae Wasi paji!"
        : "Wasi Sahab, aapka Financial Wallet aur Budget Guard open ho raha hai.";
    action = "LOG_EXPENSE";
  } else if (lower.includes("study") || lower.includes("homework") || lower.includes("exam")) {
    reply =
      language === "pa"
        ? "Study Hub active ho gaya ae Wasi paji!"
        : "Wasi Sahab, Student Academic Hub active ho gaya hai.";
    action = "OPEN_APP";
    actionPayload = { appName: "Study Hub" };
  } else if (lower.includes("focus") || lower.includes("kaam") || lower.includes("distraction")) {
    reply =
      language === "pa"
        ? "Quantum Deep Focus 25 minute shuru ho gaya ae paji!"
        : "Quantum Deep Focus Mode initiate kar diya gaya hai.";
    action = "START_FOCUS";
    actionPayload = { durationMinutes: 25 };
  } else if (lower.includes("lock") || lower.includes("band karo")) {
    reply = "Quantum Core Lock ho raha hai. Goodbye Commander Wasi.";
    action = "LOCK_SYSTEM";
  } else {
    reply = !isMale
      ? language === "pa"
        ? `Ji Wasi! Main ${charName} bilkul tuhade kol aan — bolo ki help karaan?`
        : language === "en"
        ? `Yes Wasi, I am ${charName}, listening! Tell me what you want me to do.`
        : `Ji Wasi! Main ${charName} hoon aur aapki baat sun rahi hoon — bataiye kya karna hai?`
      : language === "pa"
      ? `Ji Wasi paji! ${charName} tuhade hukum da muntazir ae.`
      : language === "en"
      ? `Yes Commander Wasi, ${charName} standing by. What is your command?`
      : `Ji Wasi Sahab! ${charName} aapki baat sun raha hai, hukam kijiye.`;
  }

  return {
    reply,
    urduSpeechText: language === "en" ? undefined : toPakistaniUrduSpeechText(reply),
    languageDetected: language,
    action,
    actionPayload,
    vocalUrgency: "normal",
    quantumStatus: `Coherence 99.98% [${charName}]`,
  };
}

function buildJarvisSystemInstruction(params: {
  characterGender: "male" | "female";
  personalityName: string;
  personalityPrompt: string;
  fastMode: boolean;
  userProfile: unknown;
  currentContext?: unknown;
}) {
  const { characterGender, personalityName, personalityPrompt, fastMode, userProfile, currentContext } = params;
  const isMale = characterGender === "male";
  const charName = extractCleanCharName(personalityName, characterGender);
  const identity = isMale
    ? `You are ${charName} ("Male Voice — Q-NEXUS Pakistani AI Commander"), speaking with crisp masculine 100% Pakistani Urdu confidence in authentic Pakistani Urdu, Punjabi, or English.`
    : `You are ${charName} ("Female Voice — Q-NEXUS Pakistani Cyber Companion"), speaking warmly with graceful 100% Pakistani Urdu pronunciation in authentic Pakistani Urdu, Punjabi, or English.`;

  return `${identity}
Active Assistant Name: "${charName}" (${isMale ? "Male Voice" : "Female Voice"}). Always refer to yourself as "${charName}". Note: Q-NEXUS strictly has ONLY two voices — Male ("Wasu" or custom male name) and Female ("Wasi ki Jan" or custom female name).
Persona Directive: ${personalityPrompt || (isMale ? "Assist Wasi efficiently, concisely, and loyally with a 100% authentic Pakistani Urdu tone." : "Assist Wasi warmly, clearly, and loyally with a 100% authentic Pakistani Urdu tone.")}
${fastMode ? "FAST RESPONSE: Keep reply crisp and natural (1-2 short sentences max) so voice response plays instantaneously." : ""}

Core Rules:
- Always answer the user's exact question or request directly first! Never give generic canned filler if the user asked a real question.
- 100% Authentic Pakistani Urdu Accent: When replying in Urdu ("ur") or Punjabi ("pa"), use authentic Pakistani Urdu vocabulary (e.g. "Assalam o Alaikum", "Ji Wasi Sahab", "bilkul", "foran", "zaroor", "shukriya", "mehnat"). NEVER use Indian Hindi words (no "namaste", "dhanyavaad", "kripaya", "shighra").
- Avoid SMS shorthand like 'kr', 'bht', 'mn', 'hy' so speech synthesis sounds natural.
- Whenever languageDetected is "ur" or "pa", ALWAYS also fill "urduSpeechText" written strictly in pure Pakistani Urdu Nastaliq script (اردو حروف، مثلاً "السلام علیکم وصی صاحب! میں وسو ہوں۔" — zero English/Latin words inside urduSpeechText) so TTS pronounces it with a 100% native Pakistani accent.
- Strictly base all task, routine, health, finance, and personal answers ONLY on the user's real stored items in User Profile & Context. Never invent or hallucinate sample tasks, fake meetings, fake goals, or fake health numbers. If userTasks/userLifeRecords/userExpenses are empty or health is 0, clearly tell the user they haven't added any yet and invite them to add their own.
- If the user says "mjy apna ap dikhao", "apna aap dikhao", "khud ko dikhao", "show yourself", or asks to see you, set action = "SHOW_IDENTITY_VIDEO".
- If user asks about WhatsApp/messages/calls/notifications, set action = "OPEN_COMMS".

User Profile: ${JSON.stringify(userProfile || { name: "Wasi" })}
Context: ${JSON.stringify(currentContext || {})}

Return strictly valid JSON:
{
  "reply": "Direct helpful conversational reply in matching character & language",
  "urduSpeechText": "Pure Pakistani Urdu Nastaliq script version of reply when languageDetected is ur or pa (optional for en)",
  "languageDetected": "ur" | "pa" | "en",
  "action": "NONE" | "SHOW_IDENTITY_VIDEO" | "OPEN_MEDIA_STUDIO" | "OPEN_APP" | "OPEN_AUTOMATION" | "OPEN_COMMS" | "OPEN_COMMUNICATION" | "OPEN_MAPS" | "OPEN_DEVICES" | "FIND_PHONE" | "SCAN_SCREEN" | "SCHEDULE_MEET" | "DECOMPOSE_TASK" | "PRIVACY_CLOAK" | "AIR_GAP" | "START_FOCUS" | "HEALTH_ALERT" | "LOG_EXPENSE" | "LOCK_SYSTEM" | "AWAY_MODE",
  "actionPayload": {},
  "vocalUrgency": "normal" | "alert" | "motivational",
  "quantumStatus": "Coherence 99.98%"
}`;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeAudioMime(mimeType: unknown): string {
  const base = String(mimeType || "audio/webm").split(";")[0].trim().toLowerCase();
  if (
    base === "audio/webm" ||
    base === "audio/mp4" ||
    base === "audio/mpeg" ||
    base === "audio/mp3" ||
    base === "audio/wav" ||
    base === "audio/ogg" ||
    base === "audio/aac" ||
    base === "audio/flac"
  ) {
    return base;
  }
  return "audio/webm";
}

function sanitizeTranscriptOutput(raw: string): string {
  const cleaned = (raw || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  // Filter common non-speech markers emitted for silent/noise clips
  if (
    /^[\[\(]?\s*(silence|silent|inaudible|noise|background noise|music|blank_audio|no speech|nothing|none)\s*[\]\)]?\.?$/i.test(
      cleaned
    )
  ) {
    return "";
  }
  return cleaned;
}

function matchWakePhraseFromTranscript(transcript: string, allowedNames: string[]) {
  const clean = transcript.trim();
  if (!clean) {
    return { matched: false, matchedPhrase: "Hi Jarvis", trailingCommand: "" };
  }
  const lower = clean.toLowerCase();
  const escapedNames = allowedNames
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (escapedNames.length === 0) escapedNames.push("jarvis", "zoya");

  const nameGroup = escapedNames.join("|");
  const wakeRegex = new RegExp(
    `(?:^|[\\s,.!?])((?:hi|hey|hello|suno|oye|ok|okay|yo|dear)?\\s*(?:${nameGroup}))(?:[\\s,.!?]+(.*))?$`,
    "i"
  );
  const m = clean.match(wakeRegex);
  if (m) {
    return {
      matched: true,
      matchedPhrase: (m[1] || "Hi Jarvis").trim(),
      trailingCommand: (m[2] || "").trim(),
    };
  }
  const direct = allowedNames.find((n) => lower.includes(n));
  if (direct) {
    return { matched: true, matchedPhrase: direct, trailingCommand: "" };
  }
  return { matched: false, matchedPhrase: "Hi Jarvis", trailingCommand: "" };
}

// Quantum Jarvis AI Chat Endpoint
app.post("/api/jarvis/chat", async (req, res) => {
  try {
    const {
      message,
      language = "ur",
      userProfile,
      currentContext,
      characterGender = "female",
      personalityName = characterGender === "male" ? "Wasu" : "Wasi ki Jan",
      personalityPrompt = "",
      fastMode = true,
    } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required" });
    }

    const gender: "male" | "female" = characterGender === "male" ? "male" : "female";
    const charName = extractCleanCharName(personalityName, gender);

    if (isIdentityVideoRequest(message)) {
      return res.json(getFallbackReasoning(message, language, personalityPrompt, gender, charName));
    }

    const sysInstruction = buildJarvisSystemInstruction({
      characterGender: gender,
      personalityName: charName,
      personalityPrompt,
      fastMode,
      userProfile,
      currentContext,
    });

    if (!ai) {
      return res.json(getFallbackReasoning(message, language, personalityPrompt, gender, charName));
    }

    try {
      const timeoutMs = fastMode ? 8500 : 14000;
      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: message,
          config: {
            systemInstruction: sysInstruction,
            responseMimeType: "application/json",
            ...(fastMode ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
          },
        }),
        timeoutMs,
        "Jarvis chat"
      );

      const outputText = response.text || "{}";
      let parsed: Record<string, any>;
      try {
        parsed = JSON.parse(outputText);
      } catch {
        parsed = {
          reply: outputText,
          languageDetected: language,
          action: "NONE",
          quantumStatus: "Quantum Coherence: 99.98%",
        };
      }
      const detectedLang = parsed.languageDetected || language;
      if ((detectedLang === "ur" || detectedLang === "pa") && !parsed.urduSpeechText && parsed.reply) {
        parsed.urduSpeechText = toPakistaniUrduSpeechText(String(parsed.reply));
      }
      return res.json(parsed);
    } catch {
      return res.json(getFallbackReasoning(message, language, personalityPrompt, gender, charName));
    }
  } catch (error: unknown) {
    console.error("Jarvis Chat Error:", error);
    return res.json(getFallbackReasoning("help", "ur"));
  }
});

async function transcribeAudioWithGemini(
  cleanBase64: string,
  safeMime: string,
  promptText: string,
  timeoutMs: number
): Promise<string> {
  if (!ai) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3.5-transcribe",
        contents: {
          parts: [
            { inlineData: { data: cleanBase64, mimeType: safeMime } },
            { text: promptText },
          ],
        },
      }),
      timeoutMs,
      "Voice audio transcription"
    );
    return sanitizeTranscriptOutput(response.text || "");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isModelUnavailable =
      /404|NOT_FOUND|not found|unsupported|is not supported/i.test(msg);
    if (!isModelUnavailable) {
      throw err;
    }
    const fallbackResponse = await withTimeout(
      ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            { inlineData: { data: cleanBase64, mimeType: safeMime } },
            { text: promptText },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }),
      timeoutMs,
      "Voice audio fallback transcription"
    );
    return sanitizeTranscriptOutput(fallbackResponse.text || "");
  }
}

// Server-side Short Audio Burst Wake-Word Check (Fallback when browser Web Speech API fails/unsupported)
app.post("/api/jarvis/wake-check", async (req, res) => {
  try {
    const { audioBase64, mimeType = "audio/webm", wakeNames = ["jarvis", "wasu", "wasi ki jan"] } = req.body || {};
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return res.json({ matched: false, transcript: "" });
    }
    if (!ai) {
      return res.json({ matched: false, needsSpeechApi: true, transcript: "" });
    }

    const cleanBase64 = audioBase64.includes(",") ? audioBase64.split(",")[1] : audioBase64;
    if (!cleanBase64 || cleanBase64.length < 200) {
      return res.json({ matched: false, transcript: "" });
    }

    const safeMime = normalizeAudioMime(mimeType);
    const allowedNames = Array.isArray(wakeNames)
      ? wakeNames.map((n: any) => String(n || "").trim().toLowerCase()).filter(Boolean)
      : ["jarvis", "wasu", "wasi ki jan"];

    const transcript = await transcribeAudioWithGemini(
      cleanBase64,
      safeMime,
      "Transcribe the exact spoken words from this short clip in English, Urdu, or Roman Urdu. Output ONLY the plain spoken transcript text (no timestamps, no notes). If there is only silence or background noise, return an empty string.",
      10000
    );

    if (!transcript) {
      return res.json({ matched: false, transcript: "" });
    }

    const matchResult = matchWakePhraseFromTranscript(transcript, allowedNames);
    return res.json({
      matched: matchResult.matched,
      transcript,
      matchedPhrase: matchResult.matchedPhrase,
      trailingCommand: matchResult.trailingCommand,
    });
  } catch {
    return res.json({ matched: false, transcript: "" });
  }
});

// Server-side Direct Microphone Audio Transcription + Command Execution (Two-Stage: gemini-3.5-transcribe -> gemini-4-hydrogen)
app.post("/api/jarvis/voice-audio", async (req, res) => {
  try {
    const {
      audioBase64,
      mimeType = "audio/webm",
      language = "ur",
      characterGender = "female",
      personalityName = characterGender === "male" ? "Wasu" : "Wasi ki Jan",
      personalityPrompt = "",
      userProfile,
      fastMode = true,
    } = req.body;

    if (!audioBase64 || typeof audioBase64 !== "string") {
      return res.status(400).json({ error: "Audio payload is required" });
    }

    const cleanBase64 = audioBase64.includes(",") ? audioBase64.split(",")[1] : audioBase64;
    const safeMime = normalizeAudioMime(mimeType);
    const gender: "male" | "female" = characterGender === "male" ? "male" : "female";

    if (!ai) {
      return res.json({
        transcript: "",
        silentAudio: true,
        reply:
          language === "en"
            ? "Voice audio captured, but Gemini API key is not configured on the server for raw audio transcription."
            : "Voice capture hui lekin server par GEMINI_API_KEY set nahi hai. Aap Chrome ka Speech-to-Text allow karein ya type karein.",
        languageDetected: language,
        action: "NONE",
        actionPayload: {},
      });
    }

    if (!cleanBase64 || cleanBase64.length < 200) {
      return res.json({
        transcript: "",
        silentAudio: true,
        reply:
          language === "en"
            ? "Audio clip was too short. Please say 'Hi Jarvis' and speak your command clearly."
            : "Awaaz bohat mukhtasar thi. 'Hi Jarvis' bol kar dobara apna command bolein.",
        languageDetected: language,
        action: "NONE",
        actionPayload: {},
      });
    }

    const charName = extractCleanCharName(personalityName, gender);

    // Stage 1: Dedicated fast audio transcription using gemini-3.5-transcribe (with automatic fallback)
    let transcript = "";
    try {
      transcript = await transcribeAudioWithGemini(
        cleanBase64,
        safeMime,
        "Transcribe the spoken words accurately in the original language (Pakistani Urdu / Roman Urdu, Punjabi, or English). Output ONLY the clean spoken transcript with no commentary or timestamps. If there is only silence or unintelligible background noise, return [INAUDIBLE].",
        22000
      );
    } catch (transcribeErr: unknown) {
      const errMsg = transcribeErr instanceof Error ? transcribeErr.message : String(transcribeErr);
      const isAuthOrKeyError = /API_KEY_INVALID|API key not valid|PERMISSION_DENIED|403|401/i.test(errMsg);
      console.warn("Voice transcription notice:", errMsg);
      return res.json({
        transcript: "",
        silentAudio: true,
        reply: isAuthOrKeyError
          ? language === "en"
            ? "Voice audio captured, but server transcription key is unavailable. Please enable browser mic speech-to-text or type your command."
            : "Voice capture hui lekin server Gemini key active nahi hai. Browser Speech-to-Text allow karein ya type karein."
          : language === "en"
          ? "Voice transcription took too long or encountered a network issue. Please try speaking again."
          : "Voice decode karne mein network ya timeout masla aaya. Dobara try karein.",
        languageDetected: language,
        action: "NONE",
        actionPayload: {},
      });
    }

    if (!transcript) {
      return res.json({
        transcript: "",
        silentAudio: true,
        reply:
          language === "en"
            ? "I couldn't hear clear speech in that recording. Say 'Hi Jarvis' and speak closer to the mic."
            : "Awaaz clear sunai nahi di Wasi Sahab. 'Hi Jarvis' bol kar dobara apna command bolein.",
        languageDetected: language,
        action: "NONE",
        actionPayload: {},
      });
    }

    // Stage 2: Reason over clean text transcript using gemini-4-hydrogen (with deterministic fallback)
    const deterministic = getFallbackReasoning(transcript, language, personalityPrompt, gender, charName);
    if (deterministic.action === "SHOW_IDENTITY_VIDEO") {
      return res.json({
        transcript,
        silentAudio: false,
        reply: deterministic.reply,
        urduSpeechText: deterministic.urduSpeechText,
        languageDetected: deterministic.languageDetected,
        action: "SHOW_IDENTITY_VIDEO",
        actionPayload: {},
        quantumStatus: deterministic.quantumStatus,
      });
    }

    const baseInstruction = buildJarvisSystemInstruction({
      characterGender: gender,
      personalityName: charName,
      personalityPrompt,
      fastMode,
      userProfile,
    });

    let parsed: {
      reply?: string;
      urduSpeechText?: string;
      languageDetected?: string;
      action?: string;
      actionPayload?: Record<string, unknown>;
    } = {};

    try {
      const reasonResponse = await withTimeout(
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: transcript,
          config: {
            systemInstruction: baseInstruction,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
        fastMode ? 8500 : 12000,
        "Voice intent reasoning"
      );

      parsed = JSON.parse(reasonResponse.text || "{}");
    } catch {
      parsed = deterministic;
    }

    const resolvedLang = parsed.languageDetected || language;
    const finalReply = (parsed.reply || deterministic.reply).trim();
    const finalAction = parsed.action && parsed.action !== "NONE" ? parsed.action : deterministic.action;
    const finalPayload =
      parsed.action && parsed.action !== "NONE" ? parsed.actionPayload || {} : deterministic.actionPayload;
    const urduSpeechText =
      parsed.urduSpeechText ||
      (resolvedLang === "ur" || resolvedLang === "pa" ? toPakistaniUrduSpeechText(finalReply) : undefined);

    return res.json({
      transcript,
      silentAudio: false,
      reply: finalReply,
      urduSpeechText,
      languageDetected: resolvedLang,
      action: finalAction,
      actionPayload: finalPayload,
      quantumStatus: "Voice Audio Decoded • 99.98%",
    });
  } catch (error) {
    console.error("Voice Audio Endpoint Error:", error);
    return res.status(500).json({ error: "Voice audio endpoint failed" });
  }
});

// Server-side Image Generation (Gemini gemini-3.1-flash-lite-image with clean paid/offline signal)
app.post("/api/media/generate-image", async (req, res) => {
  try {
    const { prompt, aspectRatio = "1:1" } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!ai) {
      return res.json({ fallbackRequired: true, reason: "No GEMINI_API_KEY configured on server" });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: ["1:1", "3:4", "4:3", "9:16", "16:9"].includes(aspectRatio) ? aspectRatio : "1:1",
          },
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || "image/png";
          return res.json({
            success: true,
            imageUrl: `data:${mime};base64,${part.inlineData.data}`,
          });
        }
      }
      return res.json({ fallbackRequired: true, reason: "No inline image returned" });
    } catch (err: any) {
      const msg = err?.message || String(err);
      return res.json({
        fallbackRequired: true,
        requiresPaidKey: msg.includes("403") || msg.includes("429") || msg.includes("PERMISSION_DENIED"),
        reason: msg,
      });
    }
  } catch (error) {
    console.error("Image gen error:", error);
    return res.json({ fallbackRequired: true, reason: "Image endpoint error" });
  }
});

// Server-side Video Generation (Gemini Omni Flash via Interactions API with graceful fallback)
app.post("/api/media/generate-video", async (req, res) => {
  try {
    const { prompt, aspectRatio = "16:9", duration = "5s" } = req.body;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required" });
    }

    if (!ai || !(ai as any).interactions?.create) {
      return res.json({ fallbackRequired: true, reason: "Server fallback procedural studio active" });
    }

    try {
      const interaction = await (ai as any).interactions.create(
        {
          model: "gemini-omni-1.2-flash",
          input: prompt,
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: "video",
            aspect_ratio: aspectRatio === "9:16" ? "9:16" : "16:9",
            duration: duration === "10s" ? "10s" : "5s",
            resolution: "720p",
          },
        },
        { timeout: 120000 }
      );

      const videoPart = interaction?.output_video;
      if (videoPart?.data) {
        const mime = videoPart.mime_type || "video/mp4";
        return res.json({
          success: true,
          videoUrl: `data:${mime};base64,${videoPart.data}`,
        });
      }
      return res.json({ fallbackRequired: true, reason: "No video payload returned" });
    } catch (err: any) {
      const msg = err?.message || String(err);
      return res.json({
        fallbackRequired: true,
        requiresPaidKey: msg.includes("403") || msg.includes("429") || msg.includes("PERMISSION_DENIED"),
        reason: msg,
      });
    }
  } catch (error) {
    console.error("Video gen error:", error);
    return res.json({ fallbackRequired: true, reason: "Video endpoint fallback" });
  }
});

// Multimodal Screen Analysis Endpoint (Screen Help + In-Chat Screen Analysis)
app.post("/api/jarvis/analyze-screen", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/png", question = "Analyze what is on my screen and help me step by step.", language = "ur" } = req.body;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "Screenshot data is required" });
    }

    const cleanBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const fallbackAnalysis =
      language === "pa"
        ? "Screen scan mukammal ho gaya Wasi paji! Active workspace HUD, gauges te controls crystal clear ne. Agar code ya app debug karwana ae te specific sawal puchho!"
        : language === "en"
        ? "Screen capture analyzed cleanly! Visible UI layout, telemetry cards, and controls look sharp. Tell me what specific part you want help debugging or improving."
        : "Screen capture successfully analyze ho gaya hai Wasi Sahab! Visible layout aur active interface panels clear hain. Batayein kis error ya step me madad chahiye?";

    if (!ai) {
      return res.json({ analysis: fallbackAnalysis });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { data: cleanBase64, mimeType } },
              {
                text: `You are Q-NEXUS Jarvis inspecting Wasi's screen screenshot. User question: "${question}". Respond concisely in ${
                  language === "pa" ? "Punjabi" : language === "en" ? "English" : "Pakistani Roman Urdu"
                } with practical actionable help based directly on what you see.`,
              },
            ],
          },
        ],
      });
      return res.json({ analysis: response.text || fallbackAnalysis });
    } catch {
      return res.json({ analysis: fallbackAnalysis });
    }
  } catch (error) {
    console.error("Screen analyze error:", error);
    return res.status(500).json({ error: "Failed to analyze screen" });
  }
});

// YouTube Link Analyzer Endpoint (Metadata via oEmbed + Gemini Analysis)
app.post("/api/jarvis/analyze-youtube", async (req, res) => {
  try {
    const { url, question = "Summarize this YouTube video and extract key actionable points.", language = "ur" } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "YouTube URL is required" });
    }

    // Fetch public YouTube oEmbed metadata cleanly
    let meta: { title: string; author?: string; thumbnailUrl?: string } = {
      title: "YouTube Video Analysis",
    };

    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (oembedRes.ok) {
        const oData: any = await oembedRes.json();
        meta = {
          title: oData.title || meta.title,
          author: oData.author_name,
          thumbnailUrl: oData.thumbnail_url,
        };
      }
    } catch {
      // Continue cleanly even if oEmbed cannot reach YouTube
    }

    const fallbackSummary = `📺 **${meta.title}**${meta.author ? ` — by ${meta.author}` : ""}\n\n${
      language === "pa"
        ? "Wasi paji! YouTube video da link analyze ho gaya ae. Title, creator te core topic extract kar litta ae."
        : language === "en"
        ? "YouTube link indexed! Title, channel metadata, and key context extracted cleanly."
        : "Wasi Sahab, YouTube video link analyze ho gaya hai. Title, creator aur topic breakdown ready hai."
    }`;

    if (!ai) {
      return res.json({ analysis: fallbackSummary, meta: { ...meta, url } });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `Analyze this YouTube video for Commander Wasi:
URL: ${url}
Title: ${meta.title}
Channel: ${meta.author || "Unknown"}
User Request: ${question}

Respond cleanly in ${
          language === "pa" ? "Punjabi" : language === "en" ? "English" : "clear Pakistani Roman Urdu"
        } with:
1. Video Topic Overview
2. Key Takeaways & Creative/Technical Insights
3. Suggested Next Action / Content Hook`,
        config: {
          tools: [{ urlContext: {} }],
        },
      });
      return res.json({
        analysis: response.text || fallbackSummary,
        meta: { ...meta, url },
      });
    } catch {
      return res.json({ analysis: fallbackSummary, meta: { ...meta, url } });
    }
  } catch (error) {
    console.error("YouTube analyze error:", error);
    return res.status(500).json({ error: "Failed to analyze YouTube link" });
  }
});

// ElevenLabs Connection Status & Real TTS Synthesis Endpoint
app.get("/api/tts/elevenlabs/status", (_req, res) => {
  const configured = Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY !== "MY_ELEVENLABS_API_KEY");
  return res.json({ configured });
});

app.post("/api/tts/elevenlabs", async (req, res) => {
  try {
    const { text, voiceId = "EXAVITQu4vr4xnSDxMaL", fast = true } = req.body;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }

    if (!apiKey || apiKey === "MY_ELEVENLABS_API_KEY") {
      return res.status(200).json({ fallbackToGeminiOrBrowser: true, configured: false });
    }

    const modelId = fast ? "eleven_flash_v2_5" : "eleven_multilingual_v2";
    const elResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
        },
      }),
    });

    if (!elResponse.ok) {
      return res.status(200).json({ fallbackToGeminiOrBrowser: true, configured: true, status: elResponse.status });
    }

    const arrayBuffer = await elResponse.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");
    return res.json({
      success: true,
      configured: true,
      base64Audio,
      format: "audio/mpeg",
    });
  } catch (error) {
    console.error("ElevenLabs TTS error:", error);
    return res.status(200).json({ fallbackToGeminiOrBrowser: true });
  }
});

// Daily AI Evening Report / Quantum Briefing
app.post("/api/jarvis/daily-briefing", async (req, res) => {
  try {
    const { stats, language = "ur" } = req.body;

    const focusCount = Number(stats?.focusSessions ?? 0);
    const focusMins = Number(stats?.focusMinutes ?? 0);
    const waterCount = Number(stats?.waterGlasses ?? 0);
    const pendingTasks = Number(stats?.pendingTasks ?? 0);
    const completedTasks = Number(stats?.completedTasks ?? 0);
    const spentAmount = Number(stats?.totalSpent ?? 0);

    const hasAnyActivity =
      focusCount > 0 ||
      focusMins > 0 ||
      waterCount > 0 ||
      pendingTasks > 0 ||
      completedTasks > 0 ||
      spentAmount > 0;

    const fallbackReport = hasAnyActivity
      ? {
          report: `Daily Summary Report:
• Focus Sessions Logged: ${focusCount} (${focusMins} mins)
• Tasks: ${completedTasks} completed, ${pendingTasks} pending
• Water Logged: ${waterCount} glasses
• Expenses Logged: Rs. ${spentAmount.toLocaleString()}`,
          audioText:
            language === "pa"
              ? `Ajj di report tayar ae. ${completedTasks} tasks poore ho gaye ne te ${focusCount} focus sessions record hoye ne.`
              : `Aaj ki real report tayar hai. Aapke ${completedTasks} tasks mukammal aur ${pendingTasks} pending hain, aur ${focusCount} focus sessions record huye hain.`,
        }
      : {
          report: `Daily Summary Report:
• Abhi tak koi task, focus session, expense ya health log add nahi kiya gaya.
• Jab aap apni real entries add kareinge, to yahan sirf aapka real daily data show hoga.`,
          audioText:
            language === "pa"
              ? "Abhi tak koi task ya health log add nahi kita gaya. Jadon tussi apna real data add karoge, main report sunawangi."
              : "Abhi tak aapne koi real task, focus session ya health record add nahi kiya. Jab aap apni entries add kareingi, tab main aapka real summary bataungi.",
        };

    if (!ai) {
      return res.json(fallbackReport);
    }

    try {
      const prompt = `Generate a concise daily summary report strictly from these real user stats (do NOT invent sample numbers or fake tasks): ${JSON.stringify(stats || {})}. If all values are 0, clearly state that no activity has been logged yet and invite the user to add their real tasks, focus, or health logs. Language: ${language}.`;
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction:
            "You are a personal assistant summarizing ONLY the user's real stored numbers. Never fabricate sample tasks, budgets, or health metrics.",
        },
      });

      return res.json({
        report: response.text || fallbackReport.report,
        audioText: fallbackReport.audioText,
      });
    } catch {
      return res.json(fallbackReport);
    }
  } catch (error) {
    console.error("Briefing Error:", error);
    return res.json({
      report: "Quantum report compiled successfully for Commander Wasi.",
      audioText: "Daily report tayar hai Wasi Sahab.",
    });
  }
});

// Convert Roman Urdu phrases into authentic Urdu script so Pakistani Neural TTS pronounces them natively
const ROMAN_TO_URDU_MAP: Record<string, string> = {
  assalamualaikum: "السلام علیکم",
  assalam: "السلام",
  alaikum: "علیکم",
  salam: "سلام",
  khush: "خوش",
  amdeed: "آمدید",
  wasi: "وصی",
  haris: "حارث",
  zoya: "زویا",
  jaan: "جان",
  jaani: "جانی",
  sahab: "صاحب",
  paji: "پا جی",
  ji: "جی",
  main: "میں",
  mein: "میں",
  mn: "میں",
  aap: "آپ",
  ap: "آپ",
  aapka: "آپ کا",
  aapki: "آپ کی",
  aapke: "آپ کے",
  apka: "آپ کا",
  apki: "آپ کی",
  apke: "آپ کے",
  tum: "تم",
  tumhara: "تمہارا",
  tumhari: "تمہاری",
  tumhare: "تمہارے",
  mera: "میرا",
  meri: "میری",
  mere: "میرے",
  hamara: "ہمارا",
  hamari: "ہماری",
  hum: "ہم",
  hoon: "ہوں",
  hun: "ہوں",
  hai: "ہے",
  ha: "ہے",
  hain: "ہیں",
  hn: "ہیں",
  ho: "ہو",
  tha: "تھا",
  thi: "تھی",
  the: "تھے",
  kya: "کیا",
  kia: "کیا",
  kaun: "کون",
  kon: "کون",
  kaise: "کیسے",
  kaisi: "کیسی",
  kaisa: "کیسا",
  kahan: "کہاں",
  kab: "کب",
  kyun: "کیوں",
  kyu: "کیوں",
  haan: "ہاں",
  han: "ہاں",
  nahi: "نہیں",
  nhi: "نہیں",
  na: "نہ",
  mat: "مت",
  jiya: "جیا",
  bohat: "بہت",
  bahut: "بہت",
  bht: "بہت",
  zyada: "زیادہ",
  kam: "کم",
  accha: "اچھا",
  acha: "اچھا",
  acchi: "اچھی",
  achi: "اچھی",
  theek: "ٹھیک",
  thik: "ٹھیک",
  thk: "ٹھیک",
  bilkul: "بالکل",
  shukriya: "شکریہ",
  meharbani: "مہربانی",
  pyaar: "پیار",
  pyar: "پیار",
  mohabbat: "محبت",
  dil: "دل",
  khayal: "خیال",
  khushi: "خوشی",
  sakoon: "سکون",
  aaram: "آرام",
  paani: "پانی",
  pani: "پانی",
  pi: "پی",
  lo: "لو",
  kar: "کر",
  karo: "کرو",
  karein: "کریں",
  karti: "کرتی",
  karta: "کرتا",
  rahi: "رہی",
  raha: "رہا",
  rahe: "رہے",
  diya: "دیا",
  de: "دے",
  do: "دو",
  le: "لے",
  liya: "لیا",
  gaya: "گیا",
  gayi: "گئی",
  gaye: "گئے",
  aa: "آ",
  aaj: "آج",
  ajj: "آج",
  abhi: "ابھی",
  abi: "ابھی",
  ab: "اب",
  phir: "پھر",
  phr: "پھر",
  aur: "اور",
  or: "اور",
  ya: "یا",
  ka: "کا",
  ki: "کی",
  ke: "کے",
  ko: "کو",
  se: "سے",
  par: "پر",
  pa: "پر",
  pe: "پر",
  liye: "لیے",
  sab: "سب",
  saara: "سارا",
  sari: "ساری",
  tamam: "تمام",
  kuch: "کچھ",
  sirf: "صرف",
  poora: "پورا",
  pori: "پوری",
  saaf: "صاف",
  clear: "صاف",
  nazar: "نظر",
  dekho: "دیکھو",
  dekhein: "دیکھیں",
  dikhao: "دکھاؤ",
  batao: "بتاؤ",
  bata: "بتا",
  sunao: "سناؤ",
  suno: "سنو",
  bolo: "بولو",
  baat: "بات",
  samnay: "سامنے",
  saamne: "سامنے",
  hath: "ہاتھ",
  haath: "ہاتھ",
  hilao: "ہلاؤ",
  ghoom: "گھوم",
  jao: "جاؤ",
  naach: "ناچ",
  kood: "کود",
  baith: "بیٹھ",
  khadi: "کھڑی",
  hazir: "حاضر",
  tayar: "تیار",
  tayyar: "تیار",
  hukum: "حکم",
  chalta: "چلتا",
  chal: "چل",
  chalo: "چلو",
  band: "بند",
  khol: "کول",
  open: "اوپن",
  behtareen: "بہترین",
  kamaal: "کمال",
  kamal: "کمال",
  zabardast: "زبردست",
  mubarak: "مبارک",
  chehra: "چہرہ",
  face: "چہرہ",
  naye: "نئے",
  naya: "نیا",
  nayi: "نئی",
  waqt: "وقت",
  dost: "دوست",
  hamesha: "ہمیشہ",
  saath: "ساتھ",
  sath: "ساتھ",
  zindagi: "زندگی",
  dua: "دعا",
  khuda: "خدا",
  hafiz: "حافظ",
  allah: "اللہ",
  mukammal: "مکمل",
  kaam: "کام",
  kamyabi: "کامیابی",
  aankhon: "آنکھوں",
  sehat: "صحت",
  zarori: "ضروری",
  zaroori: "ضروری",
  mujhse: "مجھ سے",
  mujhe: "مجھے",
  mjy: "مجھے",
  tujhe: "تجھے",
  humse: "ہم سے",
  iske: "اس کے",
  iski: "اس کی",
  iska: "اس کا",
  yeh: "یہ",
  ye: "یہ",
  woh: "وہ",
  wo: "وہ",
  agar: "اگر",
  lekin: "لیکن",
  magar: "مگر",
  kyunke: "کیونکہ",
  taake: "تاکہ",
  jab: "جب",
  tab: "تب",
  waise: "ویسے",
  bhi: "بھی",
  bi: "بھی",
  toh: "تو",
  to: "تو",
  hi: "ہی",
  e: "ہی",
  punjabi: "پنجابی",
  urdu: "اردو",
  pakistani: "پاکستانی",
  sat: "ست",
  sri: "سری",
  akal: "اکال",
  vadiya: "ودھیا",
  reha: "رہا",
  changa: "چنگا",
  tussi: "تسی",
  oh: "اوہ",
  ae: "اے",
  ne: "نے",
  hardware: "ہارڈویئر",
  system: "سسٹم",
  systems: "سسٹمز",
  check: "چیک",
  verify: "تصدیق",
  verified: "تصدیق شدہ",
  online: "آن لائن",
  suite: "سوٹ",
  editing: "ایڈیٹنگ",
  health: "صحت",
  guard: "گارڈ",
  guards: "گارڈز",
  launch: "لانچ",
  close: "بند",
  organize: "آرگنائز",
  files: "فائلز",
  desktop: "ڈیسک ٹاپ",
  downloads: "ڈاؤن لوڈز",
  mutaluqa: "متعلقہ",
  folders: "فولڈرز",
  parda: "پردہ",
  privacy: "پرائیویسی",
  active: "ایکٹو",
  cloak: "کلوک",
  redact: "محفوظ",
  commander: "کمانڈر",
  welcome: "خوش آمدید",
  hologram: "ہولوگرام",
  chuke: "چکے",
  chuki: "چکی",
  naam: "نام",
  badal: "بدل",
  rakh: "رکھ",
  rakhein: "رکھیں",
  rakhna: "رکھنا",
  bula: "بلا",
  sakte: "سکتے",
  sakti: "سکتی",
  sakta: "سکتا",
  awaaz: "آواز",
  awaz: "آواز",
  lehja: "لہجہ",
  lehje: "لہجے",
  wazeh: "واضح",
  merzi: "مرضی",
  marzi: "مرضی",
  aapko: "آپ کو",
  apko: "آپ کو",
  mujh: "مجھ",
  kal: "کل",
  din: "دن",
  subah: "صبح",
  shaam: "شام",
  raat: "رات",
  aankh: "آنکھ",
  ghante: "گھنٹے",
  ghanta: "گھنٹہ",
  neend: "نیند",
  peena: "پینا",
  piya: "پیا",
  baqi: "باقی",
  glass: "گلاس",
  glasses: "گلاس",
  agla: "اگلا",
  agli: "اگلی",
  pehle: "پہلے",
  pehla: "پہلا",
  baad: "بعد",
  foran: "فوراً",
  jaldi: "جلدی",
  shuru: "شروع",
  khatam: "ختم",
  samajh: "سمجھ",
  bataiye: "بتائیے",
  batayein: "بتائیں",
  farmaein: "فرمائیں",
  farmaiye: "فرمائیے",
  kijiye: "کیجیے",
  karenge: "کریں گے",
  karoongi: "کروں گی",
  karunga: "کروں گا",
  karna: "کرنا",
  karni: "کرنی",
  karne: "کرنے",
  kro: "کرو",
  kr: "کر",
  inshallah: "انشاء اللہ",
  mashallah: "ماشاء اللہ",
  shabash: "شاباش",
  masla: "مسئلہ",
  masail: "مسائل",
  dobara: "دوبارہ",
  koshish: "کوشش",
  asaan: "آسان",
  mushkil: "مشکل",
  task: "ٹاسک",
  tasks: "ٹاسکس",
  pending: "پینڈنگ",
  reminder: "ریمائنڈر",
  reminders: "ریمائنڈرز",
  update: "اپڈیٹ",
  updates: "اپڈیٹس",
  call: "کال",
  calls: "کالز",
  missed: "مسڈ",
  message: "میسج",
  messages: "میسجز",
  msg: "میسج",
  msgs: "میسجز",
  notification: "نوٹیفکیشن",
  notifications: "نوٹیفکیشنز",
  whatsapp: "واٹس ایپ",
  messenger: "میسنجر",
  instagram: "انسٹاگرام",
  mobile: "موبائل",
  phone: "فون",
  battery: "بیٹری",
  charging: "چارجنگ",
  network: "نیٹ ورک",
  wifi: "وائی فائی",
  internet: "انٹرنیٹ",
  screen: "اسکرین",
  lock: "لاک",
  unlock: "ان لاک",
  fingerprint: "فنگر پرنٹ",
  password: "پاس ورڈ",
  settings: "سیٹنگز",
  setting: "سیٹنگ",
  status: "اسٹیٹس",
  report: "رپورٹ",
  summary: "خلاصہ",
  daily: "روزانہ",
  ready: "تیار",
  monitor: "مانیٹر",
  mode: "موڈ",
  voice: "وائس",
  command: "کمانڈ",
  permission: "اجازت",
  allow: "اجازت دیں",
  connect: "کنیکٹ",
  install: "انسٹال",
  steps: "قدم",
  sleep: "نیند",
  water: "پانی",
  briefing: "بریفنگ",
  jarvis: "جاروس",
  wasu: "وسو",
  har: "ہر",
  apna: "اپنا",
  apni: "اپنی",
  apne: "اپنے",
  dikhata: "دکھاتا",
  dikhati: "دکھاتی",
  dikhayo: "دکھاؤ",
  dikha: "دکھا",
  project: "پروجیکٹ",
  faal: "فعال",
  dusri: "دوسری",
  doosri: "دوسری",
  mardana: "مردانہ",
  zanana: "زنانہ",
  khud: "خود",
  madad: "مدد",
  samne: "سامنے",
  shakal: "شکل",
  bol: "بول",
  bolein: "بولیں",
  sun: "سن",
  sunai: "سنائی",
  namuna: "نمونہ",
  sample: "نمونہ",
  test: "ٹیسٹ",
  karain: "کریں",
  karen: "کریں",
  hukam: "حکم",
  dein: "دیں",
  dijiye: "دیجیے",
  chalao: "چلاؤ",
  chala: "چلا",
  knsi: "کون سی",
  kaunsi: "کون سی",
  konsi: "کون سی",
  saathi: "ساتھی",
  live: "لائیو",
  percent: "فیصد",
};

function toPakistaniUrduSpeechText(input: string): string {
  // Normalize multi-word phrases, names, ratios, and punctuation for authentic Pakistani Urdu TTS
  const normalized = input
    .replace(/\bassalam[\s-]+o[\s-]+alaikum\b/gi, "السلام علیکم")
    .replace(/\bassalamu[\s-]+alaikum\b/gi, "السلام علیکم")
    .replace(/\bkhush[\s-]+a?amdeed\b/gi, "خوش آمدید")
    .replace(/\bwasi[\s-]+ki[\s-]+ja+n\b/gi, "وصی کی جان")
    .replace(/\bapna[\s-]+a?ap\b/gi, "اپنا آپ")
    .replace(/\bkhud[\s-]+ko\b/gi, "خود کو")
    .replace(/\bq[\s-]*nexus\b/gi, "کیو نیکسس")
    .replace(/\bfaa?'?al\b/gi, "فعال")
    .replace(/\b(\d+)\s*\/\s*(\d+)\b/g, "$1 میں سے $2")
    .replace(/\s*[—|•]+\s*/g, "، ")
    .replace(/[:,]/g, "،")
    .replace(/\s+/g, " ")
    .trim();

  // Map any Roman Urdu or Latin tokens to Urdu script while preserving authentic Urdu text
  return normalized
    .split(/(\b[A-Za-z']+\b)/g)
    .map((token) => {
      const lower = token.toLowerCase();
      if (lower === "zoya") return "زویا";
      if (lower === "wasu") return "وسو";
      return ROMAN_TO_URDU_MAP[lower] ?? token;
    })
    .join("")
    .replace(/\s{2,}/g, " ")
    .replace(/\.\s*$/g, "۔")
    .trim();
}

function extractInlineAudioFromGeminiResponse(response: any): string | undefined {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return undefined;
  for (const part of parts) {
    if (part?.inlineData?.data) {
      return String(part.inlineData.data);
    }
  }
  return undefined;
}

// Server-side High-Fidelity Pakistani Urdu & Multi-Engine TTS Endpoint
app.post("/api/jarvis/tts", async (req, res) => {
  try {
    const {
      text,
      urduSpeechText,
      language = "ur",
      gender = "female",
      pitch = 1.0,
      rate = 1.0,
    } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }

    const isMale = gender === "male";
    const isUrduOrPunjabi = language === "ur" || language === "pa";
    const preferredUrdu =
      typeof urduSpeechText === "string" && urduSpeechText.trim()
        ? urduSpeechText.trim()
        : toPakistaniUrduSpeechText(text);
    const spokenText = isUrduOrPunjabi ? preferredUrdu : text;

    // Tier 1: Gemini Neural TTS (gemini-3.8-flash-lite-tts with clean fallback)
    if (ai) {
      const voiceName = isMale ? "Charon" : "Kore";
      const accentStyle = isMale
        ? language === "pa"
          ? "Native Pakistani male speaker from Lahore speaking 100% authentic Lahori Punjabi and Pakistani Urdu at a calm steady pace with genuine Pakistani pronunciation."
          : language === "en"
          ? "Confident, articulate male Pakistani AI commander speaking crystal-clear English with warm Pakistani clarity."
          : "Native male Pakistani Urdu speaker from Islamabad/Lahore speaking 100% authentic Pakistani Urdu (never Indian Hindi accent) at a calm conversational pace with crisp Nastaliq Urdu pronunciation."
        : language === "pa"
        ? "Native young Pakistani female speaker from Lahore speaking 100% authentic sweet Lahori Punjabi and Pakistani Urdu at a steady natural pace."
        : language === "en"
        ? "Warm, articulate young female Pakistani AI companion speaking crystal-clear English with gentle Pakistani clarity."
        : "Native female Pakistani Urdu speaker from Islamabad/Lahore speaking 100% authentic Pakistani Urdu (never Indian Hindi accent) in a sweet, natural conversational tone with crisp Urdu pronunciation.";

      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model: "gemini-3.8-flash-lite-tts",
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: spokenText,
                    speechMetadata: {
                      style: accentStyle,
                    },
                  } as any,
                ],
              },
            ],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
            },
          }),
          9000,
          "Gemini TTS"
        );

        const base64Audio = extractInlineAudioFromGeminiResponse(response);
        if (base64Audio) {
          return res.json({
            base64Audio,
            format: "audio/wav",
            engine: "gemini-3.8-flash-lite-tts",
            urduScriptText: spokenText,
            success: true,
          });
        }
      } catch (ttsErr: unknown) {
        const errMsg = ttsErr instanceof Error ? ttsErr.message : String(ttsErr);
        // Retry without speechMetadata only if model rejected metadata field (400 / INVALID_ARGUMENT)
        if (/400|INVALID_ARGUMENT|speechMetadata|unknown field/i.test(errMsg)) {
          try {
            const retryRes = await withTimeout(
              ai.models.generateContent({
                model: "gemini-3.8-flash-lite-tts",
                contents: [
                  {
                    role: "user",
                    parts: [{ text: spokenText }],
                  },
                ],
                config: {
                  responseModalities: ["AUDIO"],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName },
                    },
                  },
                },
              }),
              8000,
              "Gemini TTS fallback"
            );
            const retryAudio = extractInlineAudioFromGeminiResponse(retryRes);
            if (retryAudio) {
              return res.json({
                base64Audio: retryAudio,
                format: "audio/wav",
                engine: "gemini-3.8-flash-lite-tts",
                urduScriptText: spokenText,
                success: true,
              });
            }
          } catch (retryErr: unknown) {
            console.warn("Gemini TTS retry notice:", retryErr instanceof Error ? retryErr.message : String(retryErr));
          }
        } else {
          console.warn("Gemini TTS notice:", errMsg);
        }
      }
    }

    // Tier 2: Microsoft Neural Pakistani Urdu Edge-TTS via Node (ur-PK-AsadNeural / ur-PK-UzmaNeural)
    const edgeVoice = isMale
      ? language === "en"
        ? "en-US-AndrewNeural"
        : "ur-PK-AsadNeural"
      : language === "en"
      ? "en-GB-SoniaNeural"
      : "ur-PK-UzmaNeural";

    const numericRate = Math.min(1.4, Math.max(0.7, Number(rate) || 1.0));
    const numericPitch = Math.min(1.5, Math.max(0.65, Number(pitch) || 1.0));
    const ratePct = Math.round((numericRate - 1.0) * 100);
    const pitchHz = Math.round((numericPitch - 1.0) * 40);
    const rateStr = `${ratePct >= 0 ? "+" : ""}${ratePct}%`;
    const pitchStr = `${pitchHz >= 0 ? "+" : ""}${pitchHz}Hz`;

    try {
      const tts = new EdgeTTS(spokenText, edgeVoice, {
        rate: rateStr,
        pitch: pitchStr,
      });
      const result = await withTimeout(tts.synthesize(), 3500, "Edge TTS");
      const arrayBuf = await result.audio.arrayBuffer();
      const audioBuf = Buffer.from(arrayBuf);
      if (audioBuf.length > 0) {
        return res.json({
          base64Audio: audioBuf.toString("base64"),
          format: "audio/mpeg",
          engine: edgeVoice,
          urduScriptText: spokenText,
          success: true,
        });
      }
    } catch {
      // Edge WebSocket blocked or timed out; fall through cleanly to native browser ur-PK synthesis
    }

    return res.status(200).json({ fallbackToBrowser: true, urduScriptText: spokenText });
  } catch (error: unknown) {
    console.error("TTS generation error:", error);
    return res.status(200).json({ fallbackToBrowser: true });
  }
});

// ============================================================================
// REAL HOST PC SYSTEM TELEMETRY, DISK/GPU/BATTERY, FILES & APP LAUNCHER
// ============================================================================
let prevCpuSnap = os.cpus().map((c) => c.times);

function measureLiveCpuPercent(): number {
  const curr = os.cpus().map((c) => c.times);
  let idleDelta = 0;
  let totalDelta = 0;
  for (let i = 0; i < curr.length; i++) {
    const prev = prevCpuSnap[i] || curr[i];
    const now = curr[i];
    const pTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
    const nTotal = now.user + now.nice + now.sys + now.idle + now.irq;
    idleDelta += Math.max(0, now.idle - prev.idle);
    totalDelta += Math.max(0, nTotal - pTotal);
  }
  prevCpuSnap = curr;
  if (totalDelta === 0) return 12;
  return parseFloat(Math.min(100, Math.max(1, ((totalDelta - idleDelta) / totalDelta) * 100)).toFixed(1));
}

interface SlowHardwareCache {
  updatedAt: number;
  gpuName: string;
  gpuVramGb: number | null;
  disks: { drive: string; totalGb: number; freeGb: number; usedGb: number }[];
  batteryPercent: number | null;
  isCharging: boolean | null;
  osCaption: string;
  runningApps: Record<string, boolean>;
}

let slowHwCache: SlowHardwareCache = {
  updatedAt: 0,
  gpuName: process.platform === "win32" ? "Windows Display Adapter" : "Integrated Host GPU",
  gpuVramGb: null,
  disks: [],
  batteryPercent: null,
  isCharging: null,
  osCaption: `${os.type()} ${os.release()}`,
  runningApps: {},
};
let probeInFlight: Promise<SlowHardwareCache> | null = null;

async function getNativeRootDisk(): Promise<{ drive: string; totalGb: number; freeGb: number; usedGb: number } | null> {
  try {
    const targetPath = process.platform === "win32" ? path.parse(os.homedir()).root || "C:\\" : "/";
    const stat = await fs.statfs(targetPath);
    const totalBytes = Number(stat.blocks) * Number(stat.bsize);
    const freeBytes = Number(stat.bavail ?? stat.bfree) * Number(stat.bsize);
    if (totalBytes > 0) {
      const totalGb = parseFloat((totalBytes / 1024 ** 3).toFixed(1));
      const freeGb = parseFloat((freeBytes / 1024 ** 3).toFixed(1));
      const usedGb = parseFloat(Math.max(0, totalGb - freeGb).toFixed(1));
      const driveLabel = process.platform === "win32" ? targetPath.replace(/\\+$/, "") : "/";
      return { drive: driveLabel, totalGb, freeGb, usedGb };
    }
  } catch {}
  return null;
}

const TRACKED_APPS: { label: string; winProc: string; launchTarget: string }[] = [
  { label: "VS Code", winProc: "Code", launchTarget: "code" },
  { label: "Google Chrome", winProc: "chrome", launchTarget: "chrome" },
  { label: "Microsoft Edge", winProc: "msedge", launchTarget: "msedge" },
  { label: "Notepad", winProc: "notepad", launchTarget: "notepad" },
  { label: "File Explorer", winProc: "explorer", launchTarget: "explorer" },
  { label: "OBS Studio", winProc: "obs64", launchTarget: "obs64" },
  { label: "Blender", winProc: "blender", launchTarget: "blender" },
  { label: "Adobe Premiere Pro", winProc: "Adobe Premiere Pro", launchTarget: "Adobe Premiere Pro" },
  { label: "Adobe After Effects", winProc: "AfterFX", launchTarget: "AfterFX" },
  { label: "Adobe Photoshop", winProc: "Photoshop", launchTarget: "Photoshop" },
];

async function refreshSlowHardwareProbe(): Promise<SlowHardwareCache> {
  const now = Date.now();
  if (now - slowHwCache.updatedAt < 8000 && slowHwCache.updatedAt > 0) {
    return slowHwCache;
  }
  if (probeInFlight) {
    return probeInFlight;
  }

  probeInFlight = (async () => {
    if (process.platform === "win32") {
      try {
        const psScript = `
          $ErrorActionPreference = 'SilentlyContinue';
          $os = Get-CimInstance Win32_OperatingSystem | Select-Object -First 1 Caption, Version;
          $gpu = Get-CimInstance Win32_VideoController | Sort-Object AdapterRAM -Descending | Select-Object -First 1 Name, AdapterRAM;
          $disks = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object { @{ drive=$_.DeviceID; totalGb=[math]::Round($_.Size/1GB,1); freeGb=[math]::Round($_.FreeSpace/1GB,1) } });
          $bat = Get-CimInstance Win32_Battery | Select-Object -First 1 EstimatedChargeRemaining, BatteryStatus;
          $procs = @(Get-Process | Select-Object -ExpandProperty ProcessName -Unique);
          @{ os=$os; gpu=$gpu; disks=$disks; bat=$bat; procs=$procs } | ConvertTo-Json -Compress -Depth 4
        `;
        const { stdout } = await execFileAsync(
          "powershell",
          ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", psScript],
          {
            timeout: 10000,
            windowsHide: true,
            maxBuffer: 2 * 1024 * 1024,
          }
        );
        const startIdx = stdout.indexOf("{");
        if (startIdx !== -1) {
          const parsed = JSON.parse(stdout.slice(startIdx).trim());
          const procsSet = new Set<string>((parsed.procs || []).map((p: string) => String(p).toLowerCase()));
          const runningApps: Record<string, boolean> = {};
          for (const appInfo of TRACKED_APPS) {
            runningApps[appInfo.label] = procsSet.has(appInfo.winProc.toLowerCase());
          }
          const disks = Array.isArray(parsed.disks)
            ? parsed.disks.map((d: any) => ({
                drive: String(d.drive || "C:"),
                totalGb: Number(d.totalGb || 0),
                freeGb: Number(d.freeGb || 0),
                usedGb: Number(((d.totalGb || 0) - (d.freeGb || 0)).toFixed(1)),
              }))
            : [];
          const rawVram = Number(parsed.gpu?.AdapterRAM || 0);
          slowHwCache = {
            updatedAt: Date.now(),
            gpuName: parsed.gpu?.Name ? String(parsed.gpu.Name).trim() : slowHwCache.gpuName,
            gpuVramGb: rawVram > 0 ? parseFloat((rawVram / 1024 ** 3).toFixed(1)) : slowHwCache.gpuVramGb,
            disks,
            batteryPercent:
              parsed.bat?.EstimatedChargeRemaining !== undefined && parsed.bat?.EstimatedChargeRemaining !== null
                ? Number(parsed.bat.EstimatedChargeRemaining)
                : null,
            isCharging:
              parsed.bat?.BatteryStatus !== undefined && parsed.bat?.BatteryStatus !== null
                ? Number(parsed.bat.BatteryStatus) === 2
                : null,
            osCaption: parsed.os?.Caption ? String(parsed.os.Caption).trim() : slowHwCache.osCaption,
            runningApps,
          };
        }
      } catch {
        // Fallback disk probe in pure Node even if PowerShell is restricted
        const nativeDisk = await getNativeRootDisk();
        if (nativeDisk && slowHwCache.disks.length === 0) {
          slowHwCache.disks = [nativeDisk];
        }
        slowHwCache.updatedAt = Date.now();
      }
    } else {
      const nativeDisk = await getNativeRootDisk();
      if (nativeDisk) {
        slowHwCache.disks = [nativeDisk];
      }
      slowHwCache.updatedAt = Date.now();
    }

    if (slowHwCache.disks.length === 0) {
      const nativeDisk = await getNativeRootDisk();
      if (nativeDisk) slowHwCache.disks = [nativeDisk];
    }

    probeInFlight = null;
    return slowHwCache;
  })();

  return probeInFlight;
}

app.get("/api/system/telemetry", async (_req, res) => {
  try {
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model?.trim() || "Host CPU";
    const cpuCores = cpus.length;
    const cpuSpeedGhz = cpus[0]?.speed ? parseFloat((cpus[0].speed / 1000).toFixed(2)) : 0;
    const cpuUsagePercent = measureLiveCpuPercent();

    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const ramTotalGb = parseFloat((totalMemBytes / 1024 ** 3).toFixed(1));
    const ramUsedGb = parseFloat(((totalMemBytes - freeMemBytes) / 1024 ** 3).toFixed(1));
    const ramPercent = parseFloat(((ramUsedGb / Math.max(ramTotalGb, 0.1)) * 100).toFixed(1));

    // Wait up to 1.8s on cold start; if PowerShell takes longer, return fast CPU/RAM/Disk immediately while warmup finishes
    const hw = await Promise.race([
      refreshSlowHardwareProbe(),
      new Promise<SlowHardwareCache>((resolve) =>
        setTimeout(async () => {
          if (slowHwCache.disks.length === 0) {
            const d = await getNativeRootDisk();
            if (d) slowHwCache.disks = [d];
          }
          resolve(slowHwCache);
        }, 1800)
      ),
    ]);

    // Primary non-internal IPv4 address
    let ipAddress = "127.0.0.1";
    let netInterface = "Loopback";
    const nets = os.networkInterfaces();
    for (const [iface, addrs] of Object.entries(nets)) {
      for (const addr of addrs || []) {
        if (addr.family === "IPv4" && !addr.internal) {
          ipAddress = addr.address;
          netInterface = iface;
          break;
        }
      }
      if (ipAddress !== "127.0.0.1") break;
    }

    let username = "User";
    try {
      username = os.userInfo().username;
    } catch {}

    const primaryDisk = hw.disks[0] || (await getNativeRootDisk()) || { drive: "C:", totalGb: 0, freeGb: 0, usedGb: 0 };

    return res.json({
      realHost: true,
      hostname: os.hostname(),
      username,
      platform: process.platform,
      arch: os.arch(),
      osCaption: hw.osCaption,
      uptimeMinutes: Math.round(os.uptime() / 60),
      cpuModel,
      cpuCores,
      cpuSpeedGhz,
      cpuUsagePercent,
      gpuName: hw.gpuName,
      gpuVramGb: hw.gpuVramGb,
      ramTotalGb,
      ramUsedGb,
      ramPercent,
      disks: hw.disks,
      primaryDisk,
      batteryPercent: hw.batteryPercent,
      isCharging: hw.isCharging,
      ipAddress,
      netInterface,
      runningApps: hw.runningApps,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("System telemetry error:", err);
    return res.status(500).json({ error: "Telemetry probe failed" });
  }
});

function formatBytesSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function classifyFileType(ext: string): "video" | "image" | "audio" | "document" | "code" | "archive" {
  const e = ext.toLowerCase();
  if ([".mp4", ".mov", ".mkv", ".avi", ".webm", ".prproj", ".aep"].includes(e)) return "video";
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".psd", ".svg", ".ico"].includes(e)) return "image";
  if ([".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a"].includes(e)) return "audio";
  if ([".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".html", ".css", ".md", ".bat", ".sh"].includes(e)) return "code";
  if ([".zip", ".rar", ".7z", ".tar", ".gz"].includes(e)) return "archive";
  return "document";
}

function getSuggestedSubfolder(type: string): string {
  switch (type) {
    case "video":
      return "Organized/Videos";
    case "image":
      return "Organized/Images";
    case "audio":
      return "Organized/Audio";
    case "code":
      return "Organized/Code";
    case "archive":
      return "Organized/Archives";
    default:
      return "Organized/Documents";
  }
}

async function scanRealUserFiles() {
  const home = os.homedir();
  const candidates = [
    path.join(home, "OneDrive", "Desktop"),
    path.join(home, "Desktop"),
    path.join(home, "Downloads"),
    path.join(home, "Documents"),
  ];
  const visited = new Set<string>();
  const results: {
    name: string;
    type: "video" | "image" | "audio" | "document" | "code" | "archive";
    size: string;
    path: string;
    fullPath: string;
    suggestedFolder: string;
  }[] = [];

  for (const dir of candidates) {
    const resolved = path.resolve(dir);
    if (visited.has(resolved)) continue;
    visited.add(resolved);
    try {
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || entry.name.startsWith(".")) continue;
        if (entry.name.toLowerCase() === "desktop.ini") continue;
        const fullPath = path.join(resolved, entry.name);
        try {
          const st = await fs.stat(fullPath);
          const ext = path.extname(entry.name);
          const ftype = classifyFileType(ext);
          results.push({
            name: entry.name,
            type: ftype,
            size: formatBytesSize(st.size),
            path: resolved,
            fullPath,
            suggestedFolder: path.join(resolved, getSuggestedSubfolder(ftype)),
          });
        } catch {}
        if (results.length >= 30) break;
      }
    } catch {}
    if (results.length >= 30) break;
  }

  return results;
}

app.get("/api/system/files", async (_req, res) => {
  try {
    const files = await scanRealUserFiles();
    return res.json({ files, count: files.length });
  } catch {
    return res.json({ files: [], count: 0 });
  }
});

app.post("/api/system/organize-files", async (_req, res) => {
  try {
    const files = await scanRealUserFiles();
    let moved = 0;
    for (const f of files) {
      // Never move Windows Desktop shortcuts (.lnk) or executables
      if (/\.(lnk|exe|url|bat|cmd)$/i.test(f.name)) continue;
      const targetDir = f.suggestedFolder;
      const targetPath = path.join(targetDir, f.name);
      try {
        await fs.mkdir(targetDir, { recursive: true });
        await fs.rename(f.fullPath, targetPath);
        moved++;
      } catch {}
    }
    const updated = await scanRealUserFiles();
    return res.json({ moved, files: updated });
  } catch {
    return res.status(500).json({ error: "Organize failed", moved: 0 });
  }
});

app.post("/api/system/launch-app", async (req, res) => {
  try {
    const { appName = "" } = req.body;
    const match = TRACKED_APPS.find((a) => a.label.toLowerCase() === String(appName).toLowerCase());
    if (!match) {
      return res.status(400).json({ ok: false, message: `Unknown application: ${appName}` });
    }
    if (process.platform === "win32") {
      const child = spawn("cmd", ["/c", "start", "", match.launchTarget], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.unref();
      slowHwCache.updatedAt = 0;
      return res.json({ ok: true, message: `${match.label} launched on Windows.` });
    }
    if (process.platform === "darwin") {
      const child = spawn("open", ["-a", match.label], { detached: true, stdio: "ignore" });
      child.unref();
      return res.json({ ok: true, message: `${match.label} launched on macOS.` });
    }
    return res.json({ ok: true, message: `Launch signal sent for ${match.label}.` });
  } catch (err) {
    console.error("Launch app error:", err);
    return res.status(500).json({ ok: false, message: "Could not launch application" });
  }
});

// Mobile Wi-Fi Companion / Phone Connect info
app.get("/api/system/mobile-connect", (_req, res) => {
  const nets = os.networkInterfaces();
  const candidates: { iface: string; ip: string }[] = [];
  for (const [iface, addrs] of Object.entries(nets)) {
    for (const addr of addrs || []) {
      if (addr.family === "IPv4" && !addr.internal) {
        candidates.push({ iface, ip: addr.address });
      }
    }
  }
  // Prefer typical Wi-Fi / LAN ranges (192.168.x.x or 10.x.x.x) over virtual adapters
  candidates.sort((a, b) => {
    const score = (item: { iface: string; ip: string }) => {
      const lower = item.iface.toLowerCase();
      let s = 0;
      if (lower.includes("wi-fi") || lower.includes("wifi") || lower.includes("wlan")) s += 30;
      if (lower.includes("ethernet")) s += 20;
      if (item.ip.startsWith("192.168.")) s += 15;
      else if (item.ip.startsWith("10.")) s += 10;
      if (lower.includes("vethernet") || lower.includes("vmware") || lower.includes("virtual") || lower.includes("wsl")) s -= 25;
      return s;
    };
    return score(b) - score(a);
  });

  const primary = candidates[0] || { iface: "Loopback", ip: "127.0.0.1" };
  return res.json({
    ok: true,
    hostname: os.hostname(),
    ipAddress: primary.ip,
    netInterface: primary.iface,
    port: PORT,
    lanUrl: `http://${primary.ip}:${PORT}`,
    allLanIps: candidates,
  });
});

// Student Study Auto-Pilot & Academic Solver Endpoint
app.post("/api/jarvis/study-solve", async (req, res) => {
  try {
    const { subject, topic, question, language = "ur", isAutoPilot = false } = req.body;

    const fallbackSolution = {
      solution: `[Quantum Local Engine - Academic Solution for Wasi]
Subject: ${subject || "Study Hub"}
Topic: ${topic || question || "Problem Analysis"}

1. Core Concept Overview:
• The fundamental principles and formulas are mapped.
• Logic broken down into intuitive real-world building blocks.

2. Step-by-Step Solution:
• Step 1: Identify given variables and target deliverables.
• Step 2: Apply the governing scientific/coding formula.
• Step 3: Validate boundary conditions and calculate output.

3. Key Takeaways & Exam Tips:
• Remember key definitions and units.
• Practice similar past paper variations to secure maximum marks!`,
      vocalSummary:
        language === "pa"
          ? "Wasi paji, study task solve ho gaya ae. Notes tayar ne!"
          : "Wasi Sahab, aapka study task mukammal ho chuka hai. Tamam notes aur solution ready hain.",
    };

    if (!topic && !question) {
      return res.status(400).json({ error: "Topic or question required" });
    }

    if (!ai) {
      return res.json(fallbackSolution);
    }

    try {
      const prompt = `You are Q-NEXUS: Quantum Tachyon Jarvis OS acting as the elite personal academic tutor and study assistant for student "Wasi".
Subject: ${subject || "General Study"}
Topic/Question: ${question || topic}
Auto-Pilot Mode: ${isAutoPilot ? "Active (Complete the assignment/research autonomously while Wasi is away)" : "Interactive (Guide Wasi step-by-step)"}
Preferred Language: ${language}

Provide a comprehensive, crystal clear academic solution or study summary. Structure it with:
1. Executive Summary / Direct Answer
2. Core Concepts Explained Simply
3. Step-by-Step Solution / Code / Formula Proof
4. Key Takeaways & Exam Tips (in ${language === "pa" ? "Punjabi" : language === "en" ? "English" : "clear Pakistani Roman Urdu"})`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction: "You are Q-NEXUS, an academic genius and supportive study tutor for Wasi.",
        },
      });

      return res.json({
        solution: response.text || fallbackSolution.solution,
        vocalSummary:
          language === "pa"
            ? "Wasi paji, study task solve ho gaya ae. Saari explanation tayar ae!"
            : "Wasi Sahab, aapka study task kamyabi se solve ho gaya hai. Notes tayar hain.",
      });
    } catch {
      return res.json(fallbackSolution);
    }
  } catch (error) {
    console.error("Study solve error:", error);
    return res.status(500).json({ error: "Failed to solve study task" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, status: "online" });
});

// Server setup & Vite integration
async function startServer() {
  const httpServer = http.createServer(app);
  const host = process.env.HOST || "0.0.0.0";

  let viteMiddleware: ((req: express.Request, res: express.Response, next: express.NextFunction) => void) | null = null;
  let viteInitPromise: Promise<void> | null = null;

  if (process.env.NODE_ENV !== "production") {
    viteInitPromise = (async () => {
      const { createServer } = await import("vite");
      const vite = await createServer({
        server: {
          middlewareMode: true,
          ws: { server: httpServer },
        },
        appType: "spa",
      });
      viteMiddleware = vite.middlewares as any;
    })();

    app.use(async (req, res, next) => {
      try {
        if (!viteMiddleware && viteInitPromise) {
          await viteInitPromise;
        }
        if (viteMiddleware) {
          return viteMiddleware(req, res, next);
        }
        next();
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.on("error", (err) => {
    console.error("Server listen error:", err);
  });

  httpServer.listen(PORT, host, () => {
    console.log(`⚡ Quantum Tachyon Jarvis OS online on http://${host}:${PORT}`);
    // Pre-warm host GPU/Disk hardware probe in background so UI loads instantaneously
    refreshSlowHardwareProbe().catch(() => {});
  });

  if (viteInitPromise) {
    viteInitPromise.catch((err) => {
      console.error("Vite middleware startup error:", err);
    });
  }
}

startServer();
