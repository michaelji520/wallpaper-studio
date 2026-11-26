# 壁纸预览台 · Wallpaper Studio

在浏览器里 1:1 预览手机壁纸的在线工具：左边是一台按真机参数复刻的手机，右边是控制台。上传图片或视频当壁纸，换个环境背景，直接看效果。

**在线体验**：<https://wallpaper-studio.heihei2thesky.top>

> 示例动态壁纸已随仓库提供（mp4 + webm 双源）；需要重新生成时执行 `bash scripts/make-assets.sh`。

## 功能

- **真机尺寸 1:1**：按设备逻辑点渲染，支持「适应窗口 / 1:1 / 20–160% 手动缩放」
- **iOS / Android 切换**：iOS 7 款（含 iPhone 18 全系与 Duo 折叠屏）、Android 4 款，切换机型自动套用该机默认开孔
- **四种屏幕开孔**：灵动岛 / 刘海 / 水滴 / 挖孔，尺寸按屏宽比例计算
- **iPhone 18 全系矢量外壳**：Pro / Pro Max 四色（酒红 · 冰川蓝 · 银 · 曜黑）与 Duo 内屏 / 外屏，机身、侧键、灵动岛、摄像头都来自外壳原图，屏幕内容按实测开口铺入
- **图片 + 视频壁纸**：拖入、上传、粘贴剪贴板、粘贴 URL 四条路径；视频静音循环，可暂停 / 关闭循环
- **环境背景**：6 套渐变场景 + 自定义背景图，支持虚化、亮度调节
- **锁屏界面**：实时时间、状态栏、手电筒 / 相机按钮、小白条；浅色壁纸会自动把文字转成深色
- **2K 导出**：整个内容区（环境背景 + 整机 + 锁屏）可导出 2560px 宽的 PNG；视频壁纸还能录一段 6 秒的 2K WebM（`captureStream + MediaRecorder`）
- **黑白主题**：标题栏最右侧一键切换深色 / 浅色界面（快捷键 `T`），偏好写入 localStorage
- **配置记忆**：机型、开孔、环境、缩放、主题等写入 localStorage，刷新不丢

快捷键：`F` 适应窗口 · `1` 切换到 1:1 · `L` 开关锁屏界面 · `T` 切换黑白主题

## 像素级参数

屏幕尺寸与圆角取自实测数据（`UIScreen._displayCornerRadius`），边框厚度由「机身宽度 − 屏幕物理宽度」反推：

| 机型 | 屏幕逻辑点 | 屏幕圆角 | 单边边框 | 机身 | 机身来源 |
|---|---|---|---|---|---|
| iPhone 18 Pro Max | 440 × 956 | 62 pt | 15.4 px | 78.0 × 163.4 mm | 矢量外壳 |
| iPhone 18 Pro | 402 × 874 | 62 pt | 16.1 px | 71.9 × 150.0 mm | 矢量外壳 |
| iPhone Duo 外屏 | 466 × 678 | 44 pt | 26 pt | 84.5 × 116.1 mm | 矢量外壳 |
| iPhone Duo 内屏 | 890 × 626 | 48 pt | 22 pt | 154.3 × 108.1 mm | 矢量外壳 |
| iPhone 17 Pro Max | 440 × 956 | 62 pt | 15.3 px | 78.0 × 163.4 mm | 程序化 |
| iPhone 16 Pro | 402 × 874 | 62 pt | 14.7 px | 71.5 × 149.6 mm | 程序化 |
| iPhone 14 | 390 × 844 | 47.33 pt | 20.8 px | 71.5 × 146.7 mm | 程序化 |

「矢量外壳」机型的机身、黑边、侧键、灵动岛、摄像头直接使用外壳 SVG 栅格化后的图片，屏幕开口位置由代码实测（`SHELLS` 里的 body / screen 矩形），玻璃反光与锁屏仍由 CSS / Canvas 绘制；其余机型继续用程序化机身。

圆角不是 CSS 的 `border-radius`（正圆弧），而是用 `clip-path: path()` 绘制的**连续曲率**曲线（算法同 figma-squircle，平滑度 60%），机身、黑边、屏幕三层各一条路径，内层的平滑度按等距偏移反推，保证边框在转角处厚度均匀。

## 本地运行

纯静态站点，没有构建步骤，也没有依赖：

```bash
# 方式一：直接打开
open index.html

# 方式二：起个本地服务（推荐，视频播放更稳）
python3 -m http.server 8765
# 然后访问 http://127.0.0.1:8765
```

## 目录结构

```
index.html            页面结构
styles.css            样式（含 squircle 裁切层与响应式）
app.js                设备数据、圆角路径生成、壁纸渲染与交互
assets/               示例动态壁纸（mp4 + webm 双源）
assets/shells/        iPhone 18 / Duo 外壳 PNG（含烘焙投影）与 src/ 下的原始 SVG
scripts/make-assets.sh  重新生成示例视频（可选）
```

预设壁纸是运行时用 Canvas 程序化生成的（渐变 + 平滑径向光斑 + 暗角 + 颗粒），不依赖任何图片文件。

### 外壳素材出处

> 原稿的底部边框只有 13 单位（顶部 47、左右 56），直接渲染会像被裁断一截。仓库里的 PNG 已把**顶部边框镜像接到底部**补齐，机身高度相应增加 30~50 单位，上下边框厚度一致；原始 SVG 保持原样留在 `src/`。

`assets/shells/` 的机身来自 Figma 社区文件 [iPhone 18 Pro / Max / Duo components (vectors)](https://www.figma.com/community/file/1686422548175302738/iphone-18-pro-max-duo-components-vectors)（作者 James Jingyi，CC BY 4.0），与其 [mockup-device-frames](https://github.com/jamesjingyi/mockup-device-frames) 仓库里的 SVG 同源。仓库保留了两份：`assets/shells/*.png` 是运行时用的 1200px 栅格图（浏览器对超大 PNG 做 2 倍以上下采样时会出现块状伪影，故预先缩到与显示尺寸接近），`assets/shells/src/*.svg` 是原始矢量，方便日后重新导出更高分辨率。

## 浏览器支持

需要支持 `clip-path: path()` 的现代浏览器（Chrome / Edge / Safari 14+ / Firefox）。
