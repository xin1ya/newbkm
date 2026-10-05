#!/bin/bash
# run.sh <key...>: ossconv build in local headless Blender
BL=/home/user/.cache/blender-4.2.3-linux-x64/blender; R=/home/user/eng
for key in "$@"; do f=/tmp/oss_$key.py
 { cat $R/art-source/tools/common.py; echo; cat $R/art-source/tools/kit.py; echo; cat $R/art-source/tools/ossconv.py; echo; echo "oss_build('$key')"; } | sed "s#__PROJECT_ROOT__#$R#g" > $f
 timeout 1200 $BL -b --factory-startup --python-exit-code 1 --python $f > /tmp/oss_$key.log 2>&1 && echo "[ok] $key" || echo "[FAIL] $key"
 grep -E "^oss|^clips|^export|Error|error:" /tmp/oss_$key.log | cut -c1-300 | tail -8
done
