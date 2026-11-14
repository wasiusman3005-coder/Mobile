import { AssistantGender, AvatarStudioConfig, JarvisInterfaceThemeId } from "../types";

export interface PersonalityMode {
  id: string;
  name: string;
  badge: string;
  emoji: string;
  gender: AssistantGender;
  voiceGender: AssistantGender;
  pitch: number;
  rate: number;
  tagline: string;
  systemPromptModifier: string;
  greetingUr: string;
  greetingEn: string;
  greetingPa: string;
}

export function getCharacterDisplayName(
  avatarConfig?: Partial<AvatarStudioConfig>,
  genderOverride?: AssistantGender
): string {
  const gender: AssistantGender = genderOverride || avatarConfig?.characterGender || "female";
  if (gender === "male") {
    const customMale = avatarConfig?.customMaleName?.trim();
    return customMale || "Wasu";
  }
  const activeId = avatarConfig?.activeCharacterId || "wasi_ki_jan";
  const nick = avatarConfig?.customNicknames?.[activeId]?.trim();
  if (nick) return nick;
  const customFemale = avatarConfig?.customFemaleName?.trim();
  return customFemale || "Wasi ki Jan";
}

export function isIdentityVideoCommand(raw: string): boolean {
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

// STRICTLY 2 VOICE PERSONAS: 1 MALE (Wasu) + 1 FEMALE (Wasi ki Jan) — User can customize & rename both anytime
export const PERSONALITY_MODES: PersonalityMode[] = [
  {
    id: "wasu_male",
    name: "Wasu (Male)",
    badge: "MALE VOICE",
    emoji: "🛡️",
    gender: "male",
    voiceGender: "male",
    pitch: 0.94,
    rate: 0.98,
    tagline: "Wasu Male Commander — 100% authentic Pakistani Urdu accent",
    systemPromptModifier:
      "You are Wasu, a loyal male Pakistani AI commander. Speak in 100% authentic, natural Pakistani Urdu accent and phrasing (like Islamabad/Lahore polite conversational Urdu) or English when asked, with zero Indian or robotic phrasing.",
    greetingUr: "Assalam o Alaikum Wasi Sahab! Main Wasu hoon, aapki har command ke liye tayar hoon.",
    greetingEn: "Online and ready, Commander Wasi. I am Wasu, say 'Hi Jarvis' or 'Hi Wasu' anytime.",
    greetingPa: "Assalam o Alaikum Wasi paji! Main Wasu aan, hukum karo ki karna ae.",
  },
  {
    id: "wasi_ki_jan_female",
    name: "Wasi ki Jan (Female)",
    badge: "FEMALE VOICE",
    emoji: "💠",
    gender: "female",
    voiceGender: "female",
    pitch: 1.03,
    rate: 0.97,
    tagline: "Wasi ki Jan Female Companion — 100% authentic Pakistani Urdu accent",
    systemPromptModifier:
      "You are Wasi ki Jan, a loving, respectful, loyal female Pakistani AI companion. Speak in 100% authentic, sweet, crystal-clear Pakistani Urdu accent and phrasing (like educated Islamabad/Lahore Pakistani Urdu) with zero Indian/foreign idioms.",
    greetingUr: "Assalam o Alaikum Wasi! Main Wasi ki Jan hoon, aapki har command ke liye tayar hoon.",
    greetingEn: "Online and ready, Wasi. I am Wasi ki Jan — say 'Hi Jarvis' anytime you want me to listen.",
    greetingPa: "Assalam o Alaikum Wasi ji! Main Wasi ki Jan aan, dasso ki hukam ae.",
  },
];

// WAKE PHRASES FOR HI JARVIS, WASU & WASI KI JAN
export const WAKE_WORDS_100_PLUS: {
  phrase: string;
  category: "Jarvis" | "Wake";
}[] = [
  { phrase: "hi jarvis", category: "Jarvis" },
  { phrase: "hey jarvis", category: "Jarvis" },
  { phrase: "hello jarvis", category: "Jarvis" },
  { phrase: "ok jarvis", category: "Jarvis" },
  { phrase: "wake up jarvis", category: "Wake" },
  { phrase: "wakeup jarvis", category: "Wake" },
  { phrase: "suno jarvis", category: "Jarvis" },
  { phrase: "hi wasu", category: "Jarvis" },
  { phrase: "hey wasu", category: "Jarvis" },
  { phrase: "suno wasu", category: "Jarvis" },
  { phrase: "hi wasi ki jan", category: "Jarvis" },
  { phrase: "hey wasi ki jan", category: "Jarvis" },
  { phrase: "suno wasi ki jan", category: "Jarvis" },
];

export const ELEVENLABS_VOICE_PRESETS = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Wasi ki Jan (Female Voice)", gender: "female" as const, style: "Clear & Sweet" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Wasu (Male Voice)", gender: "male" as const, style: "Crisp Male Commander" },
];

export interface QuantumFieldDescriptor {
  themeId: JarvisInterfaceThemeId;
  fieldName: string;
  shortName: string;
  frequencyHz: string;
  logo3DName: string;
  designIndex: number;
  colorIndex: number;
  hex: string;
}

// SINGLE QUANTUM TACHYON COCKPIT FIELD
export const QUANTUM_FIELDS_DATA: QuantumFieldDescriptor[] = [
  {
    themeId: "quantum_cockpit",
    fieldName: "ALPHA TACHYON FIELD",
    shortName: "Cockpit Field Tachyon",
    frequencyHz: "432.8 THz",
    logo3DName: "Tachyon Torus Core",
    designIndex: 0,
    colorIndex: 0,
    hex: "#00f5ff",
  },
];
