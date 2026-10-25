#!/bin/bash
# run the regression set one after another; each writes its own log
cd /home/claude/game/test
for t in flow newui dispatch events free viewcam intro; do
  echo "=== $t ===" > out/reg_$t.log
  timeout 1500 python3 -u $t.py >> out/reg_$t.log 2>&1
  echo "exit $?" >> out/reg_$t.log
done
echo ALLDONE > out/reg_done.txt
