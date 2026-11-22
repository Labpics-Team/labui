#!/usr/bin/env bash
set -euo pipefail
build=native/compose/consumer/androidApp/build
output="$build/tags-paste"
mkdir -p "$output"
adb -e install -r "$build/outputs/apk/debug/androidApp-debug.apk"
adb -e install -r "$build/outputs/apk/androidTest/debug/androidApp-debug-androidTest.apk"
adb -e shell pm clear pics.lab.ui.example
for attempt in $(seq 1 60); do
  if adb -e shell am get-started-user-state 0 | grep -q RUNNING_UNLOCKED; then break; fi
  sleep 1
done
adb -e shell am get-started-user-state 0 | grep -q RUNNING_UNLOCKED
adb -e shell am instrument -w -r -e class \
  'pics.lab.ui.example.SettingsExperienceTest#tagsPasteWithAncestorReceiverInsertsExactlyOnce' \
  pics.lab.ui.example.test/androidx.test.runner.AndroidJUnitRunner | tee "$output/result.txt"
adb -e pull /sdcard/Android/data/pics.lab.ui.example/files/verification.xml "$output/verification.xml"
adb -e pull /sdcard/Android/data/pics.lab.ui.example/files/verification.png "$output/verification.png"
adb -e logcat -d -t 2000 > "$output/logcat.txt"
sha256sum "$build/outputs/apk/debug/androidApp-debug.apk" "$build/outputs/apk/androidTest/debug/androidApp-debug-androidTest.apk" > "$output/apk-sha256.txt"
grep -q 'OK (1 test)' "$output/result.txt"
