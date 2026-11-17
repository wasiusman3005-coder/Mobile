import type {
  LiveWallpaperStyleId,
  LockScreenDesignId,
  ClockStyleId,
  DynamicBarStyleId,
  FingerprintAnimId,
  ChargingAnimId,
  HomeLayoutId,
  AppIconStyleId,
  QuickPanelStyleId,
  EdgeLightingStyleId,
  AodStyleId,
  FaceAnimId,
  UnlockBarAnimStyleId,
  WaveVisualizerStyleId,
  AppAlertRule,
} from "../types";

export const LIVE_WALLPAPER_PRESETS: Array<{
  id: LiveWallpaperStyleId;
  name: string;
  tagline: string;
  primary: string;
  secondary: string;
  bg: string;
  isDepth?: boolean;
}> = [
  { id: "depth_moon_eclipse", name: "3D Lunar Eclipse Depth", tagline: "Layered silver moon + 3D clock", primary: "#e2e8f0", secondary: "#38bdf8", bg: "#02040a", isDepth: true },
  { id: "depth_supercar_neon", name: "CyberGT Horizon 3D", tagline: "Neon street depth scene", primary: "#f97316", secondary: "#38bdf8", bg: "#0d0816", isDepth: true },
  { id: "depth_abyssal_ocean", name: "Abyssal Tide 3D Depth", tagline: "Dual-plane water surface", primary: "#22d3ee", secondary: "#0284c7", bg: "#021324", isDepth: true },
  { id: "depth_emerald_ridge", name: "Emerald Alpine Meadows", tagline: "Sunlit green 3D ridge depth", primary: "#22c55e", secondary: "#a3e635", bg: "#041a0d", isDepth: true },
  { id: "depth_obsidian_panther", name: "Obsidian Shadow Depth", tagline: "Pure OLED black depth portrait", primary: "#38bdf8", secondary: "#6366f1", bg: "#000000", isDepth: true },
  { id: "depth_alpine_peak", name: "Snow Peak Horizon 3D", tagline: "Crisp glacier depth ridge", primary: "#93c5fd", secondary: "#fb923c", bg: "#0b1528", isDepth: true },
  { id: "oneui9_aurora", name: "One UI 9 Aurora", tagline: "Silk nebula waves", primary: "#00f0ff", secondary: "#a855f7", bg: "#04081a" },
  { id: "quantum_singularity", name: "Quantum Orbit", tagline: "Rotating gyro rings", primary: "#38bdf8", secondary: "#f59e0b", bg: "#050918" },
  { id: "cosmic_rain", name: "Cosmic Meteor Rain", tagline: "High-speed star streaks", primary: "#67e8f9", secondary: "#818cf8", bg: "#030714" },
  { id: "emerald_matrix", name: "Emerald Matrix", tagline: "Digital rain cascade", primary: "#10b981", secondary: "#34d399", bg: "#02110b" },
  { id: "solar_plasma", name: "Solar Flare Plasma", tagline: "Amber molten corona", primary: "#f59e0b", secondary: "#f43f5e", bg: "#17060d" },
  { id: "cyber_grid_3d", name: "Synthwave Horizon 3D", tagline: "Moving laser perspective", primary: "#00f0ff", secondary: "#ec4899", bg: "#090418" },
  { id: "deep_ocean", name: "Bioluminescent Tide", tagline: "Calm abyssal ripples", primary: "#06b6d4", secondary: "#3b82f6", bg: "#020e1e" },
  { id: "velvet_ripples", name: "Velvet Iris Fold", tagline: "Foldable flagships silk", primary: "#c084fc", secondary: "#f472b6", bg: "#120520" },
  { id: "nebula_particles", name: "Stardust Drift", tagline: "Zero-gravity constellations", primary: "#a5f3fc", secondary: "#c084fc", bg: "#020510" },
  { id: "jarvis_reactor_clock", name: "Arc Reactor Core", tagline: "Pulse telemetry rings", primary: "#22d3ee", secondary: "#10b981", bg: "#030a16" },
];

export const LOCK_DESIGN_PRESETS: Array<{ id: LockScreenDesignId; name: string; desc: string }> = [
  { id: "oneui9_nowbar", name: "One UI 9 Now Bar Lock", desc: "Top widget deck + bottom Now Bar capsule" },
  { id: "orbital_vault", name: "Jarvis Orbital Vault", desc: "Dual gyro rings around portrait medallion" },
  { id: "glass_split", name: "Frosted Glass Split", desc: "Left vertical time + right telemetry glass card" },
  { id: "minimal_editorial", name: "Editorial Ultraclean", desc: "Oversized typographic clock & quiet surface" },
  { id: "cyber_hud", name: "Tactical HUD Grid", desc: "Precision coordinate reticle & sensor bars" },
  { id: "dual_widget_lock", name: "Dual Weather & Battery", desc: "Rich lock widgets with edge glow framing" },
];

export const CLOCK_STYLE_PRESETS: Array<{ id: ClockStyleId; name: string; sampleFont: string }> = [
  { id: "depth_editorial", name: "3D Depth Tall Clock", sampleFont: "Layered Behind Subject" },
  { id: "oneui9_bold", name: "One UI 9 Bold", sampleFont: "Bold Rounded" },
  { id: "slim_ultralight", name: "Samsung Ultralight", sampleFont: "Thin Hairline" },
  { id: "stacked_vertical", name: "Stacked Two-Tone", sampleFont: "HH / MM Vertical" },
  { id: "analog_quantum", name: "Quantum Analog Dial", sampleFont: "Precision Sweep" },
  { id: "flip_retro", name: "Flip Card Classic", sampleFont: "Split Flip Cards" },
  { id: "neon_segment", name: "Cyber LED Matrix", sampleFont: "Glow Orbitron" },
  { id: "calligraphy_mono", name: "Editorial Monospace", sampleFont: "Technical Mono" },
  { id: "floating_glass", name: "Liquid Glass Pill", sampleFont: "Frosted Depth" },
];

export const DYNAMIC_BAR_PRESETS: Array<{ id: DynamicBarStyleId; name: string; desc: string }> = [
  { id: "now_bar_pill", name: "Camera Punch-Hole Island", desc: "OLED black capsule wrapped around top camera hole" },
  { id: "liquid_island", name: "Liquid Morph Island", desc: "Expands smoothly on voice, unlock & media" },
  { id: "audio_spectrum", name: "Voice Equalizer Bar", desc: "Live reactivity spectrum beside camera" },
  { id: "minimal_dot", name: "Minimal Stealth Capsule", desc: "Ultra-compact top edge chip" },
  { id: "cyber_strip", name: "Jarvis Telemetry Strip", desc: "Monospace CPU/Net + Jarvis trigger" },
  { id: "dual_capsule", name: "Dual Split Capsules", desc: "Left voice pill + right battery chip" },
  { id: "music_ticker", name: "Media & Alert Ticker", desc: "Scrolling active app & alert summary" },
  { id: "hidden", name: "Hidden", desc: "Clean fullscreen without top capsule" },
];

export const FINGERPRINT_ANIM_PRESETS: Array<{ id: FingerprintAnimId; name: string; color: string }> = [
  { id: "ripple_wave", name: "One UI Ripple Wave", color: "#00f0ff" },
  { id: "quantum_iris", name: "Quantum Iris Vortex", color: "#a855f7" },
  { id: "neon_shockwave", name: "Sonic Shockwave", color: "#38bdf8" },
  { id: "honeycomb_scan", name: "Cyber Honeycomb", color: "#22d3ee" },
  { id: "liquid_gold", name: "Solar Gold Bloom", color: "#f59e0b" },
  { id: "particle_burst", name: "Stardust Burst", color: "#f472b6" },
  { id: "emerald_pulse", name: "Biometric Emerald", color: "#10b981" },
  { id: "starlight_ring", name: "Starlight Halo", color: "#e0f2fe" },
];

export const CHARGING_ANIM_PRESETS: Array<{ id: ChargingAnimId; name: string; accent: string }> = [
  { id: "oneui9_turbo", name: "One UI 9 Super Fast 2.0", accent: "#00f0ff" },
  { id: "warp_core", name: "SuperVOOC Warp Core", accent: "#10b981" },
  { id: "liquid_fill", name: "Liquid Glass Tank", accent: "#38bdf8" },
  { id: "lightning_arc", name: "Plasma Lightning Bolt", accent: "#a855f7" },
  { id: "magsafe_halo", name: "Magnetic Orbital Halo", accent: "#f59e0b" },
  { id: "dual_turbine", name: "Dual Hyper Turbine", accent: "#22d3ee" },
  { id: "minimal_glow", name: "Minimalist Percentage", accent: "#e2e8f0" },
  { id: "matrix_stream", name: "Quantum Energy Stream", accent: "#34d399" },
];

export const HOME_LAYOUT_PRESETS: Array<{ id: HomeLayoutId; name: string; desc: string }> = [
  { id: "oneui9_classic", name: "One UI 9 Grid (4x4)", desc: "Clean Samsung home app grid & bottom dock" },
  { id: "bento_widgets", name: "Smart Bento Cards", desc: "Weather, battery & quick widgets + app tiles" },
  { id: "minimal_dock", name: "Minimal Focus Home", desc: "Top essentials + calm breathing room" },
  { id: "circular_orbital", name: "Jarvis Radial Ring", desc: "Circular quick app orbital around clock" },
  { id: "glass_stack", name: "Frosted Glass Deck", desc: "Translucent layered glass app cards" },
  { id: "large_tiles", name: "Large Easy Mode", desc: "Oversized touch tiles for one-hand use" },
];

export const APP_ICON_STYLE_PRESETS: Array<{ id: AppIconStyleId; name: string }> = [
  { id: "oneui_squircle", name: "One UI 9 Squircle" },
  { id: "pure_circle", name: "Pure Circle" },
  { id: "teardrop", name: "Teardrop Drop" },
  { id: "cyber_hex", name: "Cyber Hexagon" },
  { id: "glass_crystal", name: "Frosted Glass" },
  { id: "neon_outline", name: "Neon Wireframe" },
  { id: "monochrome_pastel", name: "Soft Pastel Tint" },
  { id: "embossed_3d", name: "3D Depth Gloss" },
];

export const QUICK_PANEL_STYLE_PRESETS: Array<{ id: QuickPanelStyleId; name: string; desc: string }> = [
  { id: "glass_blur", name: "One UI 9 Frosted Blur", desc: "Clean Samsung rounded quick tiles" },
  { id: "neon_cyber", name: "Cyber Neon Matrix", desc: "Sharp glowing cyan/violet borders" },
  { id: "minimal_matte", name: "AMOLED Matte Dark", desc: "Ultra-dark battery-saving tiles" },
  { id: "liquid_aurora", name: "Liquid Aurora", desc: "Iridescent shifting gradient pills" },
  { id: "amoled_dual", name: "Dual-Tone Contrast", desc: "High-contrast amber & cyan cards" },
  { id: "prism_cards", name: "Bento Prism Cards", desc: "Modular asymmetric control blocks" },
  { id: "capsule_pills", name: "Dynamic Pill Switches", desc: "Long capsule slider toggles" },
  { id: "retro_matrix", name: "Emerald Terminal", desc: "Tactile monospace command toggles" },
];

export const EDGE_LIGHTING_PRESETS: Array<{ id: EdgeLightingStyleId; name: string }> = [
  { id: "off", name: "Off" },
  { id: "aurora_sweep", name: "Aurora Screen Sweep" },
  { id: "cyber_pulse", name: "Cyan Edge Pulse" },
  { id: "rainbow_prism", name: "One UI 9 Rainbow Prism" },
  { id: "emerald_spark", name: "Emerald Voice Spark" },
];

export const AOD_STYLE_PRESETS: Array<{ id: AodStyleId; name: string }> = [
  { id: "minimal_clock", name: "AMOLED Pure Clock" },
  { id: "horizon_glow", name: "Horizon Edge Glow" },
  { id: "galaxy_stars", name: "Starfield Night AOD" },
  { id: "jarvis_hud", name: "Jarvis Tactical AOD" },
];

export const ACCENT_SWATCHES = [
  "#00f0ff",
  "#38bdf8",
  "#8b5cf6",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#e2e8f0",
];

export const FACE_ANIM_PRESETS: Array<{ id: FaceAnimId; name: string; color: string; desc: string }> = [
  { id: "hologram_mesh", name: "Quantum Holo Mesh", color: "#00f0ff", desc: "3D biometric polygon reticle" },
  { id: "iris_cyber", name: "Iris Cyber Scanner", color: "#38bdf8", desc: "Dual rotating optical aperture" },
  { id: "prism_halo", name: "Aurora Prism Halo", color: "#a855f7", desc: "Iridescent glass recognition ring" },
  { id: "neural_lock", name: "Neural Matrix Sweep", color: "#10b981", desc: "Vertical laser lattice sweep" },
  { id: "quantum_grid", name: "Tactical HUD Sight", color: "#22d3ee", desc: "Corner brackets & orbital lock" },
  { id: "golden_aura", name: "Royal Gold Biometric", color: "#f59e0b", desc: "Warm luxury gold shimmer halo" },
];

export const UNLOCK_BAR_ANIM_PRESETS: Array<{ id: UnlockBarAnimStyleId; name: string; accent: string }> = [
  { id: "aurora_bloom", name: "One UI 9 Aurora Bloom", accent: "#00f0ff" },
  { id: "cyber_sweep", name: "Cyber Laser Sweep", accent: "#38bdf8" },
  { id: "emerald_wave", name: "Biometric Emerald Wave", accent: "#10b981" },
  { id: "gold_halo", name: "Royal Gold Shimmer", accent: "#f59e0b" },
  { id: "quantum_burst", name: "Prism Quantum Burst", accent: "#ec4899" },
];

export const WAVE_VISUALIZER_PRESETS: Array<{ id: WaveVisualizerStyleId; name: string; desc: string }> = [
  { id: "aurora_ribbon", name: "Aurora Silk Ribbon", desc: "Smooth flowing multi-color wave ribbons" },
  { id: "plasma_bars", name: "Plasma Spectrum Bars", desc: "Reactive neon frequency equalizer" },
  { id: "quantum_rings", name: "Quantum Pulse Rings", desc: "Concentric sonar aura rings" },
  { id: "cyber_pulse", name: "Cyber Laser Oscilloscope", desc: "High-precision harmonic trace" },
  { id: "rainbow_prism", name: "One UI 9 Rainbow Prism", desc: "Full-spectrum liquid color sweep" },
  { id: "emerald_matrix", name: "Emerald Jarvis Stream", desc: "Crisp green bio-telemetry columns" },
  { id: "solar_flare", name: "Solar Amber Flame", desc: "Warm gold-coral energy crest" },
  { id: "liquid_neon", name: "Liquid Neon Droplets", desc: "Bouncy orb pills reactive to soft voice" },
];

export const WAVE_COLOR_THEMES: Array<{ id: string; name: string; colors: [string, string, string] }> = [
  { id: "aurora_cyan", name: "Aurora Cyan-Violet", colors: ["#00f0ff", "#8b5cf6", "#ec4899"] },
  { id: "emerald_mint", name: "Emerald Mint", colors: ["#10b981", "#22d3ee", "#a7f3d0"] },
  { id: "rainbow_oneui", name: "One UI 9 Rainbow", colors: ["#38bdf8", "#a855f7", "#f43f5e"] },
  { id: "solar_gold", name: "Solar Gold Rose", colors: ["#f59e0b", "#fb7185", "#fde047"] },
  { id: "deep_cobalt", name: "Electric Cobalt", colors: ["#2563eb", "#00f0ff", "#818cf8"] },
  { id: "crimson_cyber", name: "Crimson Cyber", colors: ["#f43f5e", "#f97316", "#c084fc"] },
];

export const DEFAULT_APP_ALERT_RULES: AppAlertRule[] = [
  { id: "whatsapp", packageName: "com.whatsapp", appName: "WhatsApp", enabled: true, speakAloud: true, repeatIfUnreadMinutes: 3, allowInSleepOrQuiet: true },
  { id: "whatsapp_biz", packageName: "com.whatsapp.w4b", appName: "WhatsApp Business", enabled: true, speakAloud: true, repeatIfUnreadMinutes: 3, allowInSleepOrQuiet: true },
  { id: "phone_dialer", packageName: "com.android.incallui", appName: "Phone Calls", enabled: true, speakAloud: true, repeatIfUnreadMinutes: 1, allowInSleepOrQuiet: true },
  { id: "messages_sms", packageName: "com.google.android.apps.messaging", appName: "Messages / SMS", enabled: true, speakAloud: true, repeatIfUnreadMinutes: 5, allowInSleepOrQuiet: false },
  { id: "gmail", packageName: "com.google.android.gm", appName: "Gmail", enabled: true, speakAloud: false, repeatIfUnreadMinutes: 10, allowInSleepOrQuiet: false },
  { id: "telegram", packageName: "org.telegram.messenger", appName: "Telegram", enabled: true, speakAloud: true, repeatIfUnreadMinutes: 5, allowInSleepOrQuiet: false },
  { id: "instagram", packageName: "com.instagram.android", appName: "Instagram", enabled: true, speakAloud: false, repeatIfUnreadMinutes: 10, allowInSleepOrQuiet: false },
  { id: "youtube", packageName: "com.google.android.youtube", appName: "YouTube", enabled: true, speakAloud: false, repeatIfUnreadMinutes: 15, allowInSleepOrQuiet: false },
];

export const DYNAMIC_BAR_SELECTABLE_APPS: Array<{ packageName: string; appName: string; category: string }> = [
  { packageName: "com.whatsapp", appName: "WhatsApp", category: "Chat" },
  { packageName: "com.whatsapp.w4b", appName: "WhatsApp Business", category: "Chat" },
  { packageName: "com.google.android.apps.messaging", appName: "Messages / SMS", category: "SMS" },
  { packageName: "com.samsung.android.messaging", appName: "Samsung Messages", category: "SMS" },
  { packageName: "com.android.incallui", appName: "Phone Calls", category: "Calls" },
  { packageName: "com.samsung.android.incallui", appName: "Samsung Dialer", category: "Calls" },
  { packageName: "com.instagram.android", appName: "Instagram", category: "Social" },
  { packageName: "org.telegram.messenger", appName: "Telegram", category: "Chat" },
  { packageName: "com.google.android.gm", appName: "Gmail", category: "Email" },
  { packageName: "com.spotify.music", appName: "Spotify", category: "Music" },
  { packageName: "com.google.android.youtube", appName: "YouTube", category: "Media" },
];


