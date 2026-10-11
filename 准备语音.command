#!/bin/zsh
cd -- "${0:A:h}"
if [[ -n "$DISCUSSION_RUNTIME_DIR" ]]; then
  stage_runtime="$DISCUSSION_RUNTIME_DIR"
elif [[ -d ./show ]]; then
  stage_runtime="$PWD/.runtime"
else
  stage_runtime="${PWD:h}/.anniversary-discussion-private"
fi
mkdir -p "$stage_runtime"
chmod 700 "$stage_runtime"
/usr/bin/swiftc -parse-as-library -O -module-cache-path /private/tmp/discussion-swift-cache native/speech.swift -o "$stage_runtime/speech-worker" || exit 1
"$stage_runtime/speech-worker" --check
