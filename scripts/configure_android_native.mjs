import fs from "fs";
import path from "path";

const root = process.cwd();
const androidJavaDir = path.join(root, "android", "app", "src", "main", "java", "com", "qnexus", "jarvis");
const srcNativeDir = path.join(root, "android-native", "java", "com", "qnexus", "jarvis");

if (!fs.existsSync(path.join(root, "android"))) {
  console.error("android/ folder not found. Run 'npx cap add android' first.");
  process.exit(1);
}

fs.mkdirSync(androidJavaDir, { recursive: true });
for (const file of fs.readdirSync(srcNativeDir)) {
  fs.copyFileSync(path.join(srcNativeDir, file), path.join(androidJavaDir, file));
  console.log("Copied native plugin file:", file);
}
// Remove default Java MainActivity if MainActivity.kt is used
const oldJavaMain = path.join(androidJavaDir, "MainActivity.java");
if (fs.existsSync(oldJavaMain)) {
  fs.unlinkSync(oldJavaMain);
}

// Copy custom Lock-Vault app icons & adaptive background color
const srcNativeResDir = path.join(root, "android-native", "res");
const androidResDir = path.join(root, "android", "app", "src", "main", "res");
if (fs.existsSync(srcNativeResDir)) {
  fs.cpSync(srcNativeResDir, androidResDir, { recursive: true, force: true });
  console.log("Synced custom Lock-Vault launcher icons from android-native/res.");
}

// 1. Write hardened Android XML security & backup rules
const resXmlDir = path.join(root, "android", "app", "src", "main", "res", "xml");
fs.mkdirSync(resXmlDir, { recursive: true });

fs.writeFileSync(
  path.join(resXmlDir, "network_security_config.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">localhost</domain>
        <domain includeSubdomains="false">127.0.0.1</domain>
    </domain-config>
</network-security-config>
`,
  "utf8"
);

fs.writeFileSync(
  path.join(resXmlDir, "data_extraction_rules.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="root" />
        <exclude domain="database" />
        <exclude domain="sharedpref" />
        <exclude domain="external" />
    </cloud-backup>
    <device-transfer>
        <exclude domain="root" />
        <exclude domain="database" />
        <exclude domain="sharedpref" />
    </device-transfer>
</data-extraction-rules>
`,
  "utf8"
);

fs.writeFileSync(
  path.join(resXmlDir, "backup_rules.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
    <exclude domain="sharedpref" path="." />
    <exclude domain="database" path="." />
</full-backup-content>
`,
  "utf8"
);

fs.writeFileSync(
  path.join(resXmlDir, "jarvis_wallpaper.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<wallpaper xmlns:android="http://schemas.android.com/apk/res/android"
    android:thumbnail="@mipmap/ic_oneui_studio" />
`,
  "utf8"
);
console.log("Wrote network_security_config.xml, data_extraction_rules.xml, backup_rules.xml & jarvis_wallpaper.xml.");

const stringsPath = path.join(root, "android", "app", "src", "main", "res", "values", "strings.xml");
if (fs.existsSync(stringsPath)) {
  let stringsXml = fs.readFileSync(stringsPath, "utf8");
  stringsXml = stringsXml
    .replace(/<string name="app_name">[^<]*<\/string>/, `<string name="app_name">Wasu\\'s Jarvis</string>`)
    .replace(/<string name="title_activity_main">[^<]*<\/string>/, `<string name="title_activity_main">Wasu\\'s Jarvis</string>`);
  fs.writeFileSync(stringsPath, stringsXml, "utf8");
  console.log("Updated strings.xml app_name to Wasu's Jarvis.");
}

const manifestPath = path.join(root, "android", "app", "src", "main", "AndroidManifest.xml");
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, "utf8");
  const perms = [
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.ACCESS_WIFI_STATE",
    "android.permission.RECORD_AUDIO",
    "android.permission.CAMERA",
    "android.permission.FLASHLIGHT",
    "android.permission.READ_CALL_LOG",
    "android.permission.READ_PHONE_STATE",
    "android.permission.CALL_PHONE",
    "android.permission.ANSWER_PHONE_CALLS",
    "android.permission.READ_CONTACTS",
    "android.permission.READ_SMS",
    "android.permission.SEND_SMS",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACTIVITY_RECOGNITION",
    "android.permission.MODIFY_AUDIO_SETTINGS",
    "android.permission.VIBRATE",
    "android.permission.USE_BIOMETRIC",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_MICROPHONE",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.WAKE_LOCK",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.SET_WALLPAPER",
    "android.permission.SET_WALLPAPER_HINTS",
  ];
  for (const p of perms) {
    if (!manifest.includes(p)) {
      manifest = manifest.replace(
        "<application",
        `    <uses-permission android:name="${p}" />\n    <application`
      );
    }
  }

  if (!manifest.includes("<queries>")) {
    const queriesBlock = `    <queries>
        <intent>
            <action android:name="android.speech.RecognitionService" />
        </intent>
        <intent>
            <action android:name="android.intent.action.TTS_SERVICE" />
        </intent>
        <intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent>
        <package android:name="com.whatsapp" />
        <package android:name="com.whatsapp.w4b" />
    </queries>\n    <application`;
    manifest = manifest.replace("<application", queriesBlock);
  } else {
    if (!manifest.includes("com.whatsapp")) {
      manifest = manifest.replace(
        "</queries>",
        `        <package android:name="com.whatsapp" />\n        <package android:name="com.whatsapp.w4b" />\n    </queries>`
      );
    }
    const queriesMatch = manifest.match(/<queries>[\s\S]*?<\/queries>/);
    const queriesSection = queriesMatch ? queriesMatch[0] : "";
    if (!queriesSection.includes("android.intent.category.LAUNCHER")) {
      manifest = manifest.replace(
        "</queries>",
        `        <intent>\n            <action android:name="android.intent.action.MAIN" />\n            <category android:name="android.intent.category.LAUNCHER" />\n        </intent>\n    </queries>`
      );
    }
  }

  // Harden application attributes (disable insecure cloud backup + enforce TLS network security config)
  manifest = manifest.replace(/android:allowBackup="true"/g, 'android:allowBackup="false"');
  if (!manifest.includes("android:networkSecurityConfig=")) {
    manifest = manifest.replace(
      "<application",
      `<application\n        android:networkSecurityConfig="@xml/network_security_config"\n        android:dataExtractionRules="@xml/data_extraction_rules"\n        android:fullBackupContent="@xml/backup_rules"`
    );
  }
  if (!manifest.includes('android:showWhenLocked="true"')) {
    manifest = manifest.replace(
      /<activity\s+([^>]*android:name="\.MainActivity"[^>]*)>/,
      (_m, attrs) =>
        `<activity ${attrs
          .replace(/android:launchMode="[^"]*"/g, "")
          .trim()} android:launchMode="singleTask" android:showWhenLocked="true" android:turnScreenOn="true">`
    );
  }

  const servicesBlock = `
        <activity-alias
            android:name=".OneUiStudioAlias"
            android:targetActivity=".MainActivity"
            android:enabled="true"
            android:exported="true"
            android:label="One UI 9 Studio"
            android:icon="@mipmap/ic_oneui_studio"
            android:roundIcon="@mipmap/ic_oneui_studio">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>
        <service
            android:name=".JarvisLiveWallpaperService"
            android:label="Wasu's Jarvis One UI 9 Live Wallpaper"
            android:permission="android.permission.BIND_WALLPAPER"
            android:exported="true">
            <intent-filter>
                <action android:name="android.service.wallpaper.WallpaperService" />
            </intent-filter>
            <meta-data
                android:name="android.service.wallpaper"
                android:resource="@xml/jarvis_wallpaper" />
        </service>
        <service
            android:name=".OneUiOverlayService"
            android:enabled="true"
            android:exported="false" />
        <receiver
            android:name=".ChargingBroadcastReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.ACTION_POWER_CONNECTED" />
                <action android:name="android.intent.action.ACTION_POWER_DISCONNECTED" />
            </intent-filter>
        </receiver>
        <service
            android:name=".QNexusNotificationService"
            android:label="Wasu's Jarvis Notifications &amp; Voice"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
            android:stopWithTask="false"
            android:exported="true">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
        <service
            android:name=".JarvisWakeForegroundService"
            android:enabled="true"
            android:exported="false"
            android:stopWithTask="false"
            android:foregroundServiceType="microphone" />
        <receiver
            android:name=".JarvisBootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="com.qnexus.jarvis.ACTION_RESTART_WAKE_SERVICE" />
            </intent-filter>
        </receiver>
`;

  if (!manifest.includes("QNexusNotificationService")) {
    manifest = manifest.replace("</application>", `${servicesBlock}    </application>`);
  } else {
    manifest = manifest
      .replace(/Q-NEXUS Notifications Control|Wasu&apos;s Jarvis Notifications &amp; Voice/g, "Wasu's Jarvis Notifications &amp; Voice")
      .replace(/android:stopWithTask="true"/g, 'android:stopWithTask="false"');
    if (!manifest.includes("OneUiStudioAlias")) {
      manifest = manifest.replace(
        "</application>",
        `        <activity-alias
            android:name=".OneUiStudioAlias"
            android:targetActivity=".MainActivity"
            android:enabled="true"
            android:exported="true"
            android:label="One UI 9 Studio"
            android:icon="@mipmap/ic_oneui_studio"
            android:roundIcon="@mipmap/ic_oneui_studio">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>\n    </application>`
      );
    }
    if (!manifest.includes("JarvisLiveWallpaperService")) {
      manifest = manifest.replace(
        "</application>",
        `        <service
            android:name=".JarvisLiveWallpaperService"
            android:label="Wasu's Jarvis One UI 9 Live Wallpaper"
            android:permission="android.permission.BIND_WALLPAPER"
            android:exported="true">
            <intent-filter>
                <action android:name="android.service.wallpaper.WallpaperService" />
            </intent-filter>
            <meta-data
                android:name="android.service.wallpaper"
                android:resource="@xml/jarvis_wallpaper" />
        </service>
        <service
            android:name=".OneUiOverlayService"
            android:enabled="true"
            android:exported="false" />
        <receiver
            android:name=".ChargingBroadcastReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.ACTION_POWER_CONNECTED" />
                <action android:name="android.intent.action.ACTION_POWER_DISCONNECTED" />
            </intent-filter>
        </receiver>\n    </application>`
      );
    }
    if (!manifest.includes("JarvisBootReceiver")) {
      manifest = manifest.replace(
        "</application>",
        `        <receiver
            android:name=".JarvisBootReceiver"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="com.qnexus.jarvis.ACTION_RESTART_WAKE_SERVICE" />
            </intent-filter>
        </receiver>\n    </application>`
      );
    } else if (!manifest.includes("ACTION_RESTART_WAKE_SERVICE")) {
      manifest = manifest.replace(
        `<action android:name="android.intent.action.MY_PACKAGE_REPLACED" />`,
        `<action android:name="android.intent.action.MY_PACKAGE_REPLACED" />\n                <action android:name="com.qnexus.jarvis.ACTION_RESTART_WAKE_SERVICE" />`
      );
    }
  }

  fs.writeFileSync(manifestPath, manifest, "utf8");
  console.log("Updated AndroidManifest.xml with security config, queries, OneUiStudioAlias, live wallpaper & services.");
}

const rootGradlePath = path.join(root, "android", "build.gradle");
if (fs.existsSync(rootGradlePath)) {
  let rootGradle = fs.readFileSync(rootGradlePath, "utf8");
  if (!rootGradle.includes("kotlin-gradle-plugin")) {
    rootGradle = rootGradle.replace(
      /classpath ['"]com\.android\.tools\.build:gradle:[^'"]+['"]/,
      (m) => `${m}\n        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.0"`
    );
    fs.writeFileSync(rootGradlePath, rootGradle, "utf8");
    console.log("Added org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.0 to android/build.gradle.");
  }
}

const gradlePath = path.join(root, "android", "app", "build.gradle");
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, "utf8");
  if (!gradle.includes("kotlin-android")) {
    gradle = gradle.replace(
      /apply plugin: ['"]com\.android\.application['"]/,
      `apply plugin: 'com.android.application'\napply plugin: 'kotlin-android'`
    );
  }
  if (!gradle.includes("kotlinOptions")) {
    gradle = gradle.replace(
      /buildTypes\s*\{/,
      `compileOptions {\n        sourceCompatibility JavaVersion.VERSION_21\n        targetCompatibility JavaVersion.VERSION_21\n    }\n    kotlinOptions {\n        jvmTarget = '21'\n    }\n    buildTypes {`
    );
  }
  if (!gradle.includes("androidx.biometric:biometric")) {
    gradle = gradle.replace(
      "dependencies {",
      'dependencies {\n    implementation "androidx.biometric:biometric:1.1.0"'
    );
  }
  fs.writeFileSync(gradlePath, gradle, "utf8");
  console.log("Configured app/build.gradle with kotlin-android, jvmTarget 21 & biometric dependency.");
}

// Make android/ self-contained for Android Studio downloads (without requiring node_modules on PC)
const capAndroidSrc = path.join(root, "node_modules", "@capacitor", "android", "capacitor");
const capAndroidDest = path.join(root, "android", "capacitor-android");
if (fs.existsSync(capAndroidSrc)) {
  fs.cpSync(capAndroidSrc, capAndroidDest, { recursive: true, force: true });
  const capSettingsPath = path.join(root, "android", "capacitor.settings.gradle");
  fs.writeFileSync(
    capSettingsPath,
    "// Bundled locally inside android/ for standalone Android Studio APK builds\n" +
      "include ':capacitor-android'\n" +
      "project(':capacitor-android').projectDir = new File('./capacitor-android')\n",
    "utf8"
  );
  console.log("Bundled capacitor-android locally inside android/capacitor-android.");
}
