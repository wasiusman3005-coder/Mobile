import { JarvisInterfaceThemeId } from "../../types";

export interface ThemeMetadata {
  id: JarvisInterfaceThemeId;
  name: string;
  tagline: string;
  imagePath: string;
  accentHex: string;
  glowColor: string;
  category: string;
  features: string[];
}

export const ALL_JARVIS_THEMES: ThemeMetadata[] = [
  {
    id: "quantum_cockpit",
    name: "Cockpit Field Tachyon Theme",
    tagline: "Holographic Cockpit Command Room with Radiating Circuits & Tachyon Pedestal Core",
    imagePath: "/assets/aistudio/images_ea059939.jpg",
    accentHex: "#00f5ff",
    glowColor: "rgba(0, 245, 255, 0.7)",
    category: "3D Cockpit Field",
    features: [
      "Center Circular Tachyon Pedestal with Interactive 3D Core",
      "Radiating Neon Circuit Traces & Mobile Sensor Mesh",
      "Real Phone Hardware Telemetry & Biometric Guard",
      "Wake-Only 'Hi Jarvis' Voice & 3D Morphing Quantum Core",
    ],
  },
];
