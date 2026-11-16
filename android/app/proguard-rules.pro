# Wasu's Jarvis ProGuard / R8 Keep Rules for Release APK Security
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,SourceFile,LineNumberTable
-keep class com.qnexus.jarvis.** { *; }
-keepclassmembers class com.qnexus.jarvis.** { *; }
-keep class com.getcapacitor.** { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}
-dontwarn kotlin.**
-dontwarn kotlinx.**
