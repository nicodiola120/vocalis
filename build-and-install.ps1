$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
$env:ANDROID_HOME = 'C:\Users\Domz\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT = 'C:\Users\Domz\AppData\Local\Android\Sdk'
Set-Location 'C:\Users\Domz\Downloads\New folder (13) - Copy\android'
& .\gradlew.bat assembleDebug
$adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
& $adb install -r 'app\build\outputs\apk\debug\app-debug.apk'
& $adb shell am force-stop com.vocalis.app
& $adb shell am start -n com.vocalis.app/.MainActivity
