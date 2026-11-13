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

const manifestPath = path.join(root, "android", "app", "src", "main", "AndroidManifest.xml");
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, "utf8");
  const perms = [
    "android.permission.RECORD_AUDIO",
    "android.permission.CAMERA",
    "android.permission.READ_CALL_LOG",
    "android.permission.READ_PHONE_STATE",
    "android.permission.READ_SMS",
    "android.permission.SEND_SMS",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.VIBRATE",
    "android.permission.USE_BIOMETRIC",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_MICROPHONE",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.WAKE_LOCK",
  ];
  for (const p of perms) {
    if (!manifest.includes(p)) {
      manifest = manifest.replace(
        "<application",
        `    <uses-permission android:name="${p}" />\n    <application`
      );
    }
  }

  const servicesBlock = `
        <service
            android:name=".QNexusNotificationService"
            android:label="Q-NEXUS Notifications Control"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
        <service
            android:name=".JarvisWakeForegroundService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="microphone" />
`;

  if (!manifest.includes("QNexusNotificationService")) {
    manifest = manifest.replace("</application>", `${servicesBlock}    </application>`);
  }

  fs.writeFileSync(manifestPath, manifest, "utf8");
  console.log("Updated AndroidManifest.xml with Biometric, Mic, SMS, Call Log & Wake Service permissions.");
}

const gradlePath = path.join(root, "android", "app", "build.gradle");
if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, "utf8");
  if (!gradle.includes("androidx.biometric:biometric")) {
    gradle = gradle.replace(
      "dependencies {",
      'dependencies {\n    implementation "androidx.biometric:biometric:1.1.0"'
    );
    fs.writeFileSync(gradlePath, gradle, "utf8");
    console.log("Added androidx.biometric:biometric dependency to app/build.gradle.");
  }
}
