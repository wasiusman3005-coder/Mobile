export type LanguageCode = 'ur' | 'pa' | 'en';
export type VoiceGender = 'male' | 'female' | 'custom';
export type AccentTheme = 'cyan' | 'purple' | 'emerald' | 'amber' | 'rose' | 'blue' | 'custom';

export interface CustomVoiceProfile {
  id: string;
  name: string;
  gender: 'male' | 'female';
  assignedTo?: 'male' | 'female' | 'both';
  scheduleRule?: 'always' | 'morning' | 'evening' | 'urdu' | 'english';
  browserVoiceURI?: string;
  audioBlobUrl?: string;
  audioBase64?: string;
  pitch: number;
  rate: number;
  description?: string;
  dateAdded: string;
}

export type JarvisInterfaceThemeId = 'quantum_cockpit';

export type AssistantGender = 'male' | 'female';

export interface CharacterVoiceSlotConfig {
  pitch: number;
  rate: number;
  preferredBrowserVoiceURI?: string;
  activeCustomVoiceId?: string;
  elevenLabsVoiceId?: string;
}

export interface VoiceScheduleRule {
  enabled: boolean;
  mode: 'manual' | 'day_night' | 'language_split';
  dayStartHour: number;
  nightStartHour: number;
  dayVoice: AssistantGender;
  nightVoice: AssistantGender;
  urduVoice: AssistantGender;
  englishVoice: AssistantGender;
}

export interface AvatarStudioConfig {
  characterGender: AssistantGender;
  activeCharacterId?: string;
  customNicknames?: Record<string, string>;
  customFemaleName?: string;
  customMaleName?: string;
  personalityId: string;
  fastTalkingMode: boolean;
  useElevenLabs: boolean;
  elevenLabsVoiceId: string;
  customWakeWords: string[];
  maleVoiceSettings?: CharacterVoiceSlotConfig;
  femaleVoiceSettings?: CharacterVoiceSlotConfig;
  voiceSchedule?: VoiceScheduleRule;
}

export interface MobileSecurityConfig {
  fingerprintEnabled: boolean;
  faceUnlockEnabled: boolean;
  requireBiometricOnLaunch: boolean;
  biometricCredentialId?: string;
  enrolledDeviceLabel?: string;
  faceTemplateCaptured?: boolean;
  enrolledAt?: string;
  autoLockMinutes: number;
}

export type UserActivityState =
  | 'lying_sleeping'
  | 'sitting_stationary'
  | 'walking'
  | 'riding_bike'
  | 'unknown';

export interface VipContactRule {
  id: string;
  name: string;
  phoneOrHandle?: string;
  priority: 'critical' | 'high' | 'normal';
  repeatMinutes: number;
  alwaysSpeakAloud: boolean;
}

export interface AppAlertRule {
  id: string;
  packageName: string;
  appName: string;
  enabled: boolean;
  speakAloud: boolean;
  repeatIfUnreadMinutes: number;
  allowInSleepOrQuiet: boolean;
}

export interface ProactiveAlertConfig {
  incomingNotifications: boolean;
  speakNotificationsAloud: boolean;
  lowBatteryThreshold: number;
  taskReminders: boolean;
  networkAlerts: boolean;
  vipContacts: VipContactRule[];
  appRules: AppAlertRule[];
  taskUrgentRepeatMinutes: number;
  activityAwareMode: boolean;
  autoCallVoiceControl: boolean;
}

export type LiveWallpaperStyleId =
  | 'oneui9_aurora'
  | 'quantum_singularity'
  | 'cosmic_rain'
  | 'emerald_matrix'
  | 'solar_plasma'
  | 'cyber_grid_3d'
  | 'deep_ocean'
  | 'velvet_ripples'
  | 'nebula_particles'
  | 'jarvis_reactor_clock';

export type LockScreenDesignId =
  | 'oneui9_nowbar'
  | 'orbital_vault'
  | 'glass_split'
  | 'minimal_editorial'
  | 'cyber_hud'
  | 'dual_widget_lock';

export type ClockStyleId =
  | 'oneui9_bold'
  | 'slim_ultralight'
  | 'stacked_vertical'
  | 'analog_quantum'
  | 'flip_retro'
  | 'neon_segment'
  | 'calligraphy_mono'
  | 'floating_glass';

export type DynamicBarStyleId =
  | 'now_bar_pill'
  | 'liquid_island'
  | 'audio_spectrum'
  | 'minimal_dot'
  | 'cyber_strip'
  | 'dual_capsule'
  | 'music_ticker'
  | 'hidden';

export type FingerprintAnimId =
  | 'ripple_wave'
  | 'quantum_iris'
  | 'neon_shockwave'
  | 'honeycomb_scan'
  | 'liquid_gold'
  | 'particle_burst'
  | 'emerald_pulse'
  | 'starlight_ring';

export type ChargingAnimId =
  | 'oneui9_turbo'
  | 'warp_core'
  | 'liquid_fill'
  | 'lightning_arc'
  | 'magsafe_halo'
  | 'dual_turbine'
  | 'minimal_glow'
  | 'matrix_stream';

export type HomeLayoutId =
  | 'oneui9_classic'
  | 'bento_widgets'
  | 'minimal_dock'
  | 'circular_orbital'
  | 'glass_stack'
  | 'large_tiles';

export type AppIconStyleId =
  | 'oneui_squircle'
  | 'pure_circle'
  | 'teardrop'
  | 'cyber_hex'
  | 'glass_crystal'
  | 'neon_outline'
  | 'monochrome_pastel'
  | 'embossed_3d';

export type QuickPanelStyleId =
  | 'glass_blur'
  | 'neon_cyber'
  | 'minimal_matte'
  | 'liquid_aurora'
  | 'amoled_dual'
  | 'prism_cards'
  | 'capsule_pills'
  | 'retro_matrix';

export type EdgeLightingStyleId =
  | 'off'
  | 'aurora_sweep'
  | 'cyber_pulse'
  | 'rainbow_prism'
  | 'emerald_spark';

export type AodStyleId =
  | 'minimal_clock'
  | 'horizon_glow'
  | 'galaxy_stars'
  | 'jarvis_hud';

export type FaceAnimId =
  | 'hologram_mesh'
  | 'iris_cyber'
  | 'prism_halo'
  | 'neural_lock'
  | 'quantum_grid'
  | 'golden_aura';

export type UnlockBarAnimStyleId =
  | 'aurora_bloom'
  | 'cyber_sweep'
  | 'emerald_wave'
  | 'gold_halo'
  | 'quantum_burst';

export type WaveVisualizerStyleId =
  | 'aurora_ribbon'
  | 'plasma_bars'
  | 'quantum_rings'
  | 'cyber_pulse'
  | 'rainbow_prism'
  | 'emerald_matrix'
  | 'solar_flare'
  | 'liquid_neon';

export type DynamicBarAnchor =
  | 'top-center'
  | 'top-left'
  | 'top-right'
  | 'bottom-center'
  | 'custom';

export interface OneUiStudioConfig {
  liveWallpaperId: LiveWallpaperStyleId;
  liveWallpaperEnabledInApp: boolean;
  lockDesignId: LockScreenDesignId;
  clockStyleId: ClockStyleId;
  clockColorHex: string;
  clockScale: number;
  dynamicBarStyleId: DynamicBarStyleId;
  dynamicBarAnchor: DynamicBarAnchor;
  dynamicBarOffsetX: number;
  dynamicBarOffsetY: number;
  dynamicBarCustomLabel: string;
  dynamicBarShowOutsideApp: boolean;
  unlockBarAnimStyle: UnlockBarAnimStyleId;
  fingerprintAnimId: FingerprintAnimId;
  faceAnimId: FaceAnimId;
  chargingAnimId: ChargingAnimId;
  chargingOverlayEnabled: boolean;
  waveVisualizerStyle: WaveVisualizerStyleId;
  waveColorTheme: string;
  galleryWallpaperDataUrl: string;
  customBiometricImageDataUrl: string;
  followUpListeningEnabled: boolean;
  homeLayoutId: HomeLayoutId;
  appIconStyleId: AppIconStyleId;
  quickPanelStyleId: QuickPanelStyleId;
  edgeLightingStyle: EdgeLightingStyleId;
  aodEnabled: boolean;
  aodStyle: AodStyleId;
  blurIntensity: number;
  accentColorHex: string;
  requireStartupLock: boolean;
}

export interface SummaryLogEntry {
  id: string;
  role: 'user' | 'assistant' | 'reminder';
  speaker: string;
  text: string;
  timeStr: string;
}

export interface DashboardCustomization {
  accentTheme: AccentTheme;
  customAccentHex: string;
  customLogoUrl: string;
  customBgUrl: string;
  show3DBackground: boolean;
  activeInterfaceTheme?: JarvisInterfaceThemeId;
  brandTitle?: string;
  brandSubtitle?: string;
  logoStyle?: 'reactor' | 'tesseract' | 'crystal' | 'singularity';
  lockScreenMotionEnabled?: boolean;
  lockScreenColorShift?: boolean;
  lockScreenDesignStyle?: 'orbital' | 'cyber_grid' | 'aurora_waves';
  dockShowLabels?: boolean;
  dockIconSize?: 'compact' | 'normal' | 'large';
  hudOpacity?: number;
  proactiveAlerts?: ProactiveAlertConfig;
  screensaverType: 'sentry' | 'matrix' | 'nebula' | 'vortex';
  screensaverTimeoutMinutes: number;
  screensaverMessage: string;
  continuousWorkLimitMinutes: number;
  mandatoryRestMinutes: number;
  scanlines: boolean;
  hudGlowLevel: 'subtle' | 'vibrant' | 'ultra';
  customVoices: CustomVoiceProfile[];
  activeVoiceMode: VoiceGender;
  activeCustomVoiceId?: string;
  avatarConfig?: AvatarStudioConfig;
  securityConfig?: MobileSecurityConfig;
  oneUiConfig?: OneUiStudioConfig;
}

export interface UserProfile {
  username: string;
  displayName: string;
  title: string;
  preferredLanguage: LanguageCode;
  voiceGender: VoiceGender;
  dailyWaterTargetGlasses: number;
  dailyFocusTargetMinutes: number;
  monthlyBudget: number;
  emergencyFundTarget: number;
  primarySoftwares: string[];
  personalNotes: string[];
  goals: string[];
}

export interface SystemTelemetry {
  cpuUsage: number;
  cpuTemp: number;
  cpuFreq: number;
  gpuUsage: number;
  gpuTemp: number;
  gpuVramUsed: number;
  gpuVramTotal: number;
  ramUsed: number;
  ramTotal: number;
  storageUsed: number;
  storageTotal: number;
  quantumCoherence: number;
  downloadSpeedMbps: number;
  uploadSpeedMbps: number;
  uptimeSeconds: number;
}

export interface TaskItem {
  id: string;
  title: string;
  category: 'editing' | 'coding' | 'fitness' | 'finance' | 'general';
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  dueDate?: string;
  assignedToJarvis?: boolean;
}

export interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  category: 'hardware' | 'food' | 'subscriptions' | 'personal' | 'investment' | 'bills';
  isFazoolKharchi: boolean;
  date: string;
  notes?: string;
}

export interface HealthState {
  waterDrankGlasses: number;
  lastWaterReminder: number;
  eyeRestIntervalMinutes: number;
  lastEyeRest: number;
  postureAlertsCount: number;
  mealsLogged: {
    meal: 'Breakfast' | 'Lunch' | 'Dinner' | 'Healthy Snack';
    desc: string;
    calories: number;
    proteinGrams: number;
    healthy: boolean;
  }[];
  sleepHoursLastNight: number;
  dailySteps: number;
}

export interface EditingMacro {
  id: string;
  software: 'Mobile Hardware' | 'Notifications' | 'Battery & Perf' | 'GPS & Security';
  title: string;
  commandSnippet: string;
  voicePromptUrdu: string;
  voicePromptEnglish: string;
  voicePromptPunjabi: string;
  category: 'hardware' | 'alerts' | 'battery' | 'cleanup' | 'security';
}

export interface FileItem {
  name: string;
  type: 'video' | 'image' | 'audio' | 'document' | 'archive' | 'code';
  size: string;
  path: string;
  suggestedFolder: string;
  selected?: boolean;
}

export interface JarvisChatMessage {
  id: string;
  sender: 'user' | 'jarvis';
  text: string;
  language?: LanguageCode;
  timestamp: string;
  actionExecuted?: string;
  quantumTelemetry?: string;
  imageUrl?: string;
  videoUrl?: string;
  youtubeMeta?: {
    title: string;
    author?: string;
    thumbnailUrl?: string;
    url: string;
  };
  screenSnapshotUrl?: string;
}

export interface AppConnectorItem {
  id: string;
  name: 'Gmail' | 'Slack' | 'Notion' | 'GitHub' | 'Google Calendar' | 'Trello' | 'Asana' | 'Jira';
  category: 'communication' | 'productivity' | 'development' | 'project';
  connected: boolean;
  statusText: string;
  lastSync: string;
  activeItemsCount: number;
  quickActionLabel: string;
}

export interface ScheduledRoutineItem {
  id: string;
  title: string;
  schedule: string;
  category: 'workflow' | 'maintenance' | 'health' | 'sync';
  steps: string[];
  enabled: boolean;
  lastExecuted: string;
}

export interface CommMessageItem {
  id: string;
  platform: 'whatsapp' | 'telegram' | 'slack' | 'email';
  sender: string;
  snippet: string;
  receivedTime: string;
  priority: 'urgent' | 'high' | 'normal';
  autoDraftReply: string;
  status: 'unread' | 'replied' | 'pending';
}

export interface MeetingItem {
  id: string;
  title: string;
  platform: 'Google Meet' | 'Zoom';
  time: string;
  durationMinutes: number;
  attendees: string[];
  link: string;
  conflictDetected: boolean;
}

export interface SupportTicketItem {
  id: string;
  ticketNumber: string;
  customerName: string;
  subject: string;
  category: 'Billing' | 'Technical' | 'Integration' | 'Feature';
  priority: 'P1 - Critical' | 'P2 - High' | 'P3 - Medium';
  status: 'Open' | 'In Review' | 'Resolved';
  autoDraftReply: string;
}

export interface DecomposedTaskItem {
  id: string;
  title: string;
  category: 'backend' | 'frontend' | 'devops' | 'testing';
  hours: number;
  dependencies: string[];
  priority: 'critical' | 'high' | 'medium';
  completed: boolean;
}

export interface JiraGitHubIssueItem {
  id: string;
  provider: 'Jira' | 'GitHub';
  issueKey: string;
  title: string;
  type: 'Bug' | 'Feature' | 'Task' | 'Refactor';
  priority: 'Highest' | 'High' | 'Medium';
  assignee: string;
  status: 'Backlog' | 'In Progress' | 'Done';
}

export type DeviceType = 'mobile' | 'tablet' | 'wearable' | 'smart_light' | 'audio_dac' | 'smart_plug' | 'peripherals';
export type DeviceConnectionProtocol = 'BLE' | 'WiFi_LAN' | 'USB_C' | 'Cloud_Relay';

export interface ConnectedDeviceItem {
  id: string;
  name: string;
  type: DeviceType;
  model: string;
  osVersion?: string;
  protocol: DeviceConnectionProtocol;
  ipAddress?: string;
  batteryPercent?: number;
  isCharging?: boolean;
  signalStrengthDbm?: number;
  status: 'online' | 'standby' | 'syncing' | 'offline';
  lastPing: string;
  paired: boolean;
  controllableStates: {
    power?: boolean;
    brightness?: number; // 0-100 for smart lights
    colorHex?: string; // for RGB lights
    volume?: number; // 0-100 for audio
    hotspotActive?: boolean; // for mobile
    screenLocked?: boolean; // for mobile/tablet
    doNotDisturb?: boolean;
    ringing?: boolean;
  };
  metrics?: {
    storageUsedGb?: number;
    storageTotalGb?: number;
    ramUsedPercent?: number;
    heartRateBpm?: number; // for wearable
    stepsToday?: number; // for wearable
  };
  location?: {
    lat: number;
    lng: number;
    locationName: string;
  };
}

export interface MapLocationItem {
  id: string;
  title: string;
  category: 'base' | 'studio' | 'device' | 'poi' | 'waypoint';
  lat: number;
  lng: number;
  description: string;
  accuracyMeters?: number;
  associatedDeviceId?: string;
}

export interface DeviceCommandLog {
  id: string;
  deviceId: string;
  deviceName: string;
  action: string;
  timestamp: string;
  status: 'success' | 'pending' | 'failed';
}
