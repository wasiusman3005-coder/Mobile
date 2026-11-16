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

const stringsPath = path.join(root, "android", "app", "src", "main", "res", "values", "strings.xml");
if (fs.existsSync(stringsPath)) {
  let stringsXml = fs.readFileSync(stringsPath, "utf8");
  stringsXml = stringsXml
    .replace(/<string name="app_name">[^<]*<\/string>/, `<string name="app_name">Wasu&apos;s Jarvis</string>`)
    .replace(/<string name="title_activity_main">[^<]*<\/string>/, `<string name="title_activity_main">Wasu&apos;s Jarvis</string>`);
  fs.writeFileSync(stringsPath, stringsXml, "utf8");
  console.log("Updated strings.xml app_name to Wasu's Jarvis.");
}

const manifestPath = path.join(root, "android", "app", "src", "main", "AndroidManifest.xml");
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, "utf8");
  const perms = [
    "android.permission.RECORD_AUDIO",
    "android.permission.CAMERA",
    "android.permission.FLASHLIGHT",
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
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
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
            android:label="Wasu&apos;s Jarvis Notifications &amp; Voice"
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
            </intent-filter>
        </receiver>
`;

  if (!manifest.includes("QNexusNotificationService")) {
    manifest = manifest.replace("</application>", `${servicesBlock}    </application>`);
  } else {
    manifest = manifest
      .replace(/Q-NEXUS Notifications Control/g, "Wasu&apos;s Jarvis Notifications &amp; Voice")
      .replace(/android:stopWithTask="true"/g, 'android:stopWithTask="false"');
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
            </intent-filter>
        </receiver>\n    </application>`
      );
    }
  }

  fs.writeFileSync(manifestPath, manifest, "utf8");
  console.log("Updated AndroidManifest.xml with Flashlight, Biometric, Boot Receiver & Wake Service permissions.");
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
