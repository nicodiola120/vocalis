$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
$env:ANDROID_HOME = 'C:\Users\Domz\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT = 'C:\Users\Domz\AppData\Local\Android\Sdk'
Set-Location 'C:\Users\Domz\Downloads\New folder (13) - Copy'
& node_modules\.bin\cap.cmd run android --livereload --external --no-sync
