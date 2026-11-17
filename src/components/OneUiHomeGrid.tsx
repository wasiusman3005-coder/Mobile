import React from "react";
import {
  Phone,
  MessageCircle,
  Youtube,
  Camera,
  Globe,
  Settings,
  Image,
  MapPin,
  Calculator,
  Clock,
  Music,
  Palette,
} from "lucide-react";
import type { HomeLayoutId, AppIconStyleId, ClockStyleId } from "../types";
import { openInstalledAppAndroid } from "../services/nativeAndroidBridge";
import { OneUiClockPreview } from "./OneUiClockPreview";

interface OneUiHomeGridProps {
  layoutId: HomeLayoutId;
  iconStyleId: AppIconStyleId;
  clockStyleId: ClockStyleId;
  accentHex?: string;
  clockColorHex?: string;
  onOpenOneUiStudio: () => void;
  onToast: (msg: string) => void;
}

const PHONE_SHORTCUT_APPS = [
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, tint: "#10b981" },
  { id: "phone", label: "Phone", icon: Phone, tint: "#38bdf8" },
  { id: "youtube", label: "YouTube", icon: Youtube, tint: "#f43f5e" },
  { id: "camera", label: "Camera", icon: Camera, tint: "#a855f7" },
  { id: "chrome", label: "Chrome", icon: Globe, tint: "#00f0ff" },
  { id: "gallery", label: "Gallery", icon: Image, tint: "#f59e0b" },
  { id: "maps", label: "Maps", icon: MapPin, tint: "#34d399" },
  { id: "spotify", label: "Music", icon: Music, tint: "#22d3ee" },
  { id: "calculator", label: "Calc", icon: Calculator, tint: "#cbd5e1" },
  { id: "clock", label: "Clock", icon: Clock, tint: "#818cf8" },
  { id: "settings", label: "Settings", icon: Settings, tint: "#94a3b8" },
  { id: "oneui9", label: "One UI 9", icon: Palette, tint: "#00f0ff" },
];

export function getIconShapeStyle(iconStyleId: AppIconStyleId, tint: string, accentHex: string): React.CSSProperties {
  switch (iconStyleId) {
    case "pure_circle":
      return {
        borderRadius: "9999px",
        background: `linear-gradient(145deg, ${tint}30, #070d1f)`,
        border: `1.5px solid ${tint}80`,
      };
    case "teardrop":
      return {
        borderRadius: "24px 24px 24px 6px",
        background: `linear-gradient(145deg, ${tint}35, #070d1f)`,
        border: `1.5px solid ${tint}90`,
      };
    case "cyber_hex":
      return {
        borderRadius: "10px",
        clipPath: "polygon(25% 4%, 75% 4%, 98% 50%, 75% 96%, 25% 96%, 2% 50%)",
        background: `linear-gradient(145deg, ${tint}40, #050a18)`,
      };
    case "glass_crystal":
      return {
        borderRadius: "20px",
        background: "rgba(255,255,255,0.09)",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(255,255,255,0.28)",
      };
    case "neon_outline":
      return {
        borderRadius: "18px",
        background: "#020510",
        border: `2px solid ${accentHex}`,
        boxShadow: `0 0 14px ${accentHex}44`,
      };
    case "monochrome_pastel":
      return {
        borderRadius: "20px",
        background: `${accentHex}24`,
        border: `1px solid ${accentHex}55`,
      };
    case "embossed_3d":
      return {
        borderRadius: "20px",
        background: `linear-gradient(160deg, ${tint}45, #040814)`,
        border: `1.5px solid ${tint}aa`,
        boxShadow: `0 8px 18px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.3)`,
      };
    default:
      // oneui_squircle
      return {
        borderRadius: "22px",
        background: `linear-gradient(145deg, ${tint}2c, #070e22)`,
        border: `1.5px solid ${tint}75`,
      };
  }
}

export const OneUiHomeGrid: React.FC<OneUiHomeGridProps> = ({
  layoutId,
  iconStyleId,
  clockStyleId,
  accentHex = "#00f0ff",
  clockColorHex = "#e0f2fe",
  onOpenOneUiStudio,
  onToast,
}) => {
  const launchApp = async (id: string, label: string) => {
    if (id === "oneui9") {
      onOpenOneUiStudio();
      return;
    }
    const res = await openInstalledAppAndroid(id);
    onToast(res.message || `${label} launch requested`);
  };

  const gridCols =
    layoutId === "large_tiles"
      ? "grid-cols-2 sm:grid-cols-3 gap-3.5"
      : layoutId === "bento_widgets" || layoutId === "glass_stack"
      ? "grid-cols-3 sm:grid-cols-4 gap-3"
      : "grid-cols-4 gap-3";

  return (
    <div className="w-full max-w-2xl mx-auto px-3 py-4 flex flex-col items-center gap-5">
      {/* Top Home Clock Widget */}
      <div className="w-full rounded-3xl bg-slate-950/45 backdrop-blur-xl border border-slate-400/20 p-4 flex flex-col items-center">
        <OneUiClockPreview
          styleId={clockStyleId}
          colorHex={clockColorHex}
          accentHex={accentHex}
          compact={layoutId !== "minimal_dock"}
        />
      </div>

      {/* App Grid */}
      <div
        className={`w-full ${gridCols} ${
          layoutId === "glass_stack"
            ? "p-4 rounded-3xl bg-slate-950/50 backdrop-blur-xl border border-slate-400/20"
            : ""
        }`}
      >
        {PHONE_SHORTCUT_APPS.map((app) => {
          const Icon = app.icon;
          const shapeStyle = getIconShapeStyle(iconStyleId, app.tint, accentHex);
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => launchApp(app.id, app.label)}
              className={`min-h-[68px] flex ${
                layoutId === "large_tiles"
                  ? "flex-row items-center gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-400/20"
                  : "flex-col items-center justify-center gap-1.5 py-2"
              } cursor-pointer transition-transform active:scale-95`}
            >
              <div
                className="w-12 h-12 flex items-center justify-center shadow-md shrink-0"
                style={shapeStyle}
              >
                <Icon
                  className="w-5 h-5"
                  style={{
                    color: iconStyleId === "monochrome_pastel" ? accentHex : app.tint,
                  }}
                />
              </div>
              <span className="text-[11px] font-sans font-medium text-slate-200 truncate max-w-full">
                {app.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
