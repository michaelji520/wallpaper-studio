#!/usr/bin/env bash
# 生成演示用的动态壁纸（需要本机装 ffmpeg）
# 仓库里不存放二进制视频，克隆后跑一次这个脚本即可。
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets

ffmpeg -y -f lavfi -i "gradients=s=720x1560:d=6:c0=0x06070f:c1=0x123a52:c2=0x2f7d8c:c3=0x8a5a6e:c4=0x1a1030:n=4:x0=120:y0=180:x1=620:y1=1400:speed=0.012:type=linear" \
  -vf format=yuv420p -c:v libx264 -crf 27 -preset veryfast -r 30 -movflags +faststart assets/demo-loop.mp4

ffmpeg -y -i assets/demo-loop.mp4 -c:v libvpx-vp9 -b:v 0 -crf 38 -an assets/demo-loop.webm

echo "✅ assets/demo-loop.mp4 / assets/demo-loop.webm 已生成"
