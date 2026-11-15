import { UserProfile, TaskItem, ExpenseItem, HealthState, EditingMacro, FileItem, DashboardCustomization, AvatarStudioConfig, MobileSecurityConfig } from "../types";

export const CLEAN_SLATE_VERSION = "v3-clean-no-sample";

const STORAGE_KEYS = {
  CLEAN_VERSION: "q_nexus_clean_cache_version",
  USER_PROFILE: "q_nexus_user_profile",
  TASKS: "q_nexus_tasks",
  EXPENSES: "q_nexus_expenses",
  HEALTH: "q_nexus_health",
  LIFE_RECORDS: "q_nexus_life_records",
  STUDY_TASKS: "q_nexus_study_tasks",
  FOCUS_LOGS: "q_nexus_focus_logs",
  MOBILE_VAULT_FILES: "q_nexus_mobile_vault_files",
  FINANCE_SETTINGS: "q_nexus_finance_settings",
  CHAT_LOGS: "q_nexus_chat_logs",
  SECURITY: "q_nexus_security",
  SETTINGS: "q_nexus_settings",
  CUSTOMIZATION: "q_nexus_customization",
};

export const defaultAvatarConfig: AvatarStudioConfig = {
  characterGender: "female",
  activeCharacterId: "wasi_ki_jan",
  customNicknames: {},
  customFemaleName: "Wasi ki Jan",
  customMaleName: "Wasu",
  personalityId: "wasi_ki_jan_female",
  fastTalkingMode: true,
  useElevenLabs: false,
  elevenLabsVoiceId: "EXAVITQu4vr4xnSDxMaL",
  customWakeWords: [],
  maleVoiceSettings: {
    pitch: 0.94,
    rate: 0.98,
    elevenLabsVoiceId: "pNInz6obpgDQGcFmaJgB",
  },
  femaleVoiceSettings: {
    pitch: 1.03,
    rate: 0.97,
    elevenLabsVoiceId: "EXAVITQu4vr4xnSDxMaL",
  },
  voiceSchedule: {
    enabled: false,
    mode: "manual",
    dayStartHour: 6,
    nightStartHour: 19,
    dayVoice: "male",
    nightVoice: "female",
    urduVoice: "female",
    englishVoice: "male",
  },
};

export const defaultSecurityConfig: MobileSecurityConfig = {
  fingerprintEnabled: false,
  faceUnlockEnabled: false,
  requireBiometricOnLaunch: false,
  biometricCredentialId: undefined,
  enrolledDeviceLabel: undefined,
  faceTemplateCaptured: false,
  enrolledAt: undefined,
  autoLockMinutes: 5,
};

export const defaultCustomization: DashboardCustomization = {
  accentTheme: "cyan",
  customAccentHex: "#06b6d4",
  customLogoUrl: "",
  customBgUrl: "",
  show3DBackground: true,
  activeInterfaceTheme: "quantum_cockpit",
  screensaverType: "sentry",
  screensaverTimeoutMinutes: 5,
  screensaverMessage: "QUANTUM MOBILE SENTRY ACTIVE • PHONE PROTECTED",
  continuousWorkLimitMinutes: 45,
  mandatoryRestMinutes: 5,
  scanlines: false,
  hudGlowLevel: "ultra",
  customVoices: [
    {
      id: "voice-wasi-ki-jan-ur",
      name: "Wasi ki Jan (Pakistani Urdu Female)",
      gender: "female",
      assignedTo: "female",
      scheduleRule: "always",
      pitch: 1.03,
      rate: 0.97,
      description: "100% Pakistani Urdu female voice",
      dateAdded: "System Voice",
    },
    {
      id: "voice-wasu-ur",
      name: "Wasu (Pakistani Urdu Male)",
      gender: "male",
      assignedTo: "male",
      scheduleRule: "always",
      pitch: 0.94,
      rate: 0.98,
      description: "100% Pakistani Urdu male voice",
      dateAdded: "System Voice",
    },
  ],
  activeVoiceMode: "female",
  activeCustomVoiceId: "voice-wasi-ki-jan-ur",
  avatarConfig: defaultAvatarConfig,
  securityConfig: defaultSecurityConfig,
};

export const defaultUserProfile: UserProfile = {
  username: "wasu3005",
  displayName: "Wasi",
  title: "Personal Commander",
  preferredLanguage: "ur",
  voiceGender: "female",
  dailyWaterTargetGlasses: 8,
  dailyFocusTargetMinutes: 120,
  monthlyBudget: 0,
  emergencyFundTarget: 0,
  primarySoftwares: [],
  personalNotes: [],
  goals: [],
};

export const defaultTasks: TaskItem[] = [];

export const defaultExpenses: ExpenseItem[] = [];

export const defaultHealthState: HealthState = {
  waterDrankGlasses: 0,
  lastWaterReminder: 0,
  eyeRestIntervalMinutes: 20,
  lastEyeRest: Date.now(),
  postureAlertsCount: 0,
  mealsLogged: [],
  sleepHoursLastNight: 0,
  dailySteps: 0,
};

export const defaultMacros: EditingMacro[] = [];

export const defaultFiles: FileItem[] = [];

function ensureCleanCacheInitialized(): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    const marker = localStorage.getItem(STORAGE_KEYS.CLEAN_VERSION);
    if (marker === CLEAN_SLATE_VERSION) return;

    // Purge any legacy pre-populated sample data from older installs/cache
    localStorage.removeItem(STORAGE_KEYS.TASKS);
    localStorage.removeItem(STORAGE_KEYS.EXPENSES);
    localStorage.removeItem(STORAGE_KEYS.HEALTH);
    localStorage.removeItem(STORAGE_KEYS.LIFE_RECORDS);
    localStorage.removeItem(STORAGE_KEYS.STUDY_TASKS);
    localStorage.removeItem(STORAGE_KEYS.FOCUS_LOGS);
    localStorage.removeItem(STORAGE_KEYS.MOBILE_VAULT_FILES);
    localStorage.removeItem(STORAGE_KEYS.FINANCE_SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.CHAT_LOGS);

    // Strip any old sample notes/goals from cached profile while keeping custom displayName/lang
    const rawProfile = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (rawProfile) {
      try {
        const parsed = JSON.parse(rawProfile);
        localStorage.setItem(
          STORAGE_KEYS.USER_PROFILE,
          JSON.stringify({
            ...defaultUserProfile,
            username: parsed.username || defaultUserProfile.username,
            displayName: parsed.displayName || defaultUserProfile.displayName,
            preferredLanguage: parsed.preferredLanguage || defaultUserProfile.preferredLanguage,
            voiceGender: parsed.voiceGender || defaultUserProfile.voiceGender,
            personalNotes: [],
            goals: [],
            primarySoftwares: [],
            monthlyBudget: 0,
            emergencyFundTarget: 0,
          })
        );
      } catch {
        localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
      }
    }

    localStorage.setItem(STORAGE_KEYS.CLEAN_VERSION, CLEAN_SLATE_VERSION);

    // Also flush stale SW caches in background so phone install is 100% fresh
    if ("caches" in window) {
      window.caches.keys().then((keys) => {
        keys.forEach((k) => {
          window.caches.delete(k).catch(() => {});
        });
      }).catch(() => {});
    }
  } catch {
    // Ignore storage restriction errors
  }
}

export class StorageService {
  constructor() {
    ensureCleanCacheInitialized();
  }

  getUserProfile(): UserProfile {
    ensureCleanCacheInitialized();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? { ...defaultUserProfile, ...JSON.parse(data) } : { ...defaultUserProfile };
    } catch {
      return { ...defaultUserProfile };
    }
  }

  saveUserProfile(profile: UserProfile): void {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    } catch {
      // Ignored
    }
  }

  getTasks(): TaskItem[] {
    ensureCleanCacheInitialized();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TASKS);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveTasks(tasks: TaskItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch {
      // Ignored
    }
  }

  getExpenses(): ExpenseItem[] {
    ensureCleanCacheInitialized();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveExpenses(expenses: ExpenseItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    } catch {
      // Ignored
    }
  }

  getHealth(): HealthState {
    ensureCleanCacheInitialized();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HEALTH);
      if (!data) return { ...defaultHealthState };
      return { ...defaultHealthState, ...JSON.parse(data) };
    } catch {
      return { ...defaultHealthState };
    }
  }

  saveHealth(health: HealthState): void {
    try {
      localStorage.setItem(STORAGE_KEYS.HEALTH, JSON.stringify(health));
    } catch {
      // Ignored
    }
  }

  getCustomization(): DashboardCustomization {
    ensureCleanCacheInitialized();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOMIZATION);
      if (!data) return defaultCustomization;
      const parsed = JSON.parse(data);
      const rawAvatar = parsed.avatarConfig || {};
      const migratedFemaleName =
        !rawAvatar.customFemaleName || rawAvatar.customFemaleName === "Zoya"
          ? "Wasi ki Jan"
          : rawAvatar.customFemaleName;
      const migratedMaleName =
        !rawAvatar.customMaleName || rawAvatar.customMaleName === "Jarvis"
          ? "Wasu"
          : rawAvatar.customMaleName;
      const migratedNicks = { ...(rawAvatar.customNicknames || {}) };
      if (migratedNicks.zoya === "Zoya") delete migratedNicks.zoya;
      const migratedVoices = Array.isArray(parsed.customVoices)
        ? parsed.customVoices.map((v: any) => {
            if (v?.id === "voice-zoya-pak-urdu") {
              return { ...v, name: "Wasi ki Jan (Pakistani Urdu Female)", assignedTo: "female" };
            }
            if (v?.id === "voice-jarvis-male") {
              return { ...v, name: "Wasu (Pakistani Urdu Male)", assignedTo: "male" };
            }
            return v;
          })
        : defaultCustomization.customVoices;

      return {
        ...defaultCustomization,
        ...parsed,
        customVoices: migratedVoices,
        avatarConfig: {
          ...defaultAvatarConfig,
          ...rawAvatar,
          activeCharacterId:
            rawAvatar.activeCharacterId === "zoya" || !rawAvatar.activeCharacterId
              ? "wasi_ki_jan"
              : rawAvatar.activeCharacterId,
          customFemaleName: migratedFemaleName,
          customMaleName: migratedMaleName,
          customNicknames: migratedNicks,
          personalityId:
            rawAvatar.personalityId === "jarvis_male"
              ? "wasu_male"
              : rawAvatar.personalityId === "zoya_female" || !rawAvatar.personalityId
              ? "wasi_ki_jan_female"
              : rawAvatar.personalityId,
          maleVoiceSettings: {
            ...defaultAvatarConfig.maleVoiceSettings!,
            ...(rawAvatar.maleVoiceSettings || {}),
          },
          femaleVoiceSettings: {
            ...defaultAvatarConfig.femaleVoiceSettings!,
            ...(rawAvatar.femaleVoiceSettings || {}),
          },
          voiceSchedule: {
            ...defaultAvatarConfig.voiceSchedule!,
            ...(rawAvatar.voiceSchedule || {}),
          },
        },
        securityConfig: {
          ...defaultSecurityConfig,
          ...(parsed.securityConfig || {}),
        },
      };
    } catch {
      return defaultCustomization;
    }
  }

  saveCustomization(cust: DashboardCustomization): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOMIZATION, JSON.stringify(cust));
    } catch {}
  }

  async clearAllCacheAndPersonalData(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
      localStorage.removeItem(STORAGE_KEYS.TASKS);
      localStorage.removeItem(STORAGE_KEYS.EXPENSES);
      localStorage.removeItem(STORAGE_KEYS.HEALTH);
      localStorage.removeItem(STORAGE_KEYS.LIFE_RECORDS);
      localStorage.removeItem(STORAGE_KEYS.STUDY_TASKS);
      localStorage.removeItem(STORAGE_KEYS.FOCUS_LOGS);
      localStorage.removeItem(STORAGE_KEYS.MOBILE_VAULT_FILES);
      localStorage.removeItem(STORAGE_KEYS.FINANCE_SETTINGS);
      localStorage.removeItem(STORAGE_KEYS.CHAT_LOGS);
      localStorage.setItem(STORAGE_KEYS.CLEAN_VERSION, CLEAN_SLATE_VERSION);

      if (typeof window !== "undefined" && "caches" in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((k) => window.caches.delete(k)));
      }
    } catch {
      // Ignored
    }
  }

  exportFullBackup(): string {
    const backup = {
      version: "3.0.0-clean",
      timestamp: new Date().toISOString(),
      userProfile: this.getUserProfile(),
      customization: this.getCustomization(),
      tasks: this.getTasks(),
      expenses: this.getExpenses(),
      health: this.getHealth(),
    };
    return JSON.stringify(backup, null, 2);
  }

  importFullBackup(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.userProfile) this.saveUserProfile(data.userProfile);
      if (data.customization) this.saveCustomization(data.customization);
      if (data.tasks) this.saveTasks(data.tasks);
      if (data.expenses) this.saveExpenses(data.expenses);
      if (data.health) this.saveHealth(data.health);
      return true;
    } catch (e) {
      console.warn("Backup import warning:", e);
      return false;
    }
  }
}

export const storageService = new StorageService();
