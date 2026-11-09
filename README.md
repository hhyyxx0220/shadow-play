# 赛博皮影戏

基于手势识别的交互式皮影戏网页作品。打开摄像头，用手势操控皮影角色，配合光影特效重现传统皮影戏。

## 在线体验

https://hhyyxx0220.github.io/shadow-play/

## 使用方法

1. 用 Chrome / Edge / Safari 打开上面的网址
2. 允许浏览器调用摄像头
3. 按照页面提示用手势操控皮影

## 本地运行

项目需要 HTTP 服务器环境（摄像头功能限制），不能直接双击 index.html 打开。

## 技术说明

- 手势识别：MediaPipe Hand Landmarker（本地离线运行，无外部依赖）
- 音效：Web Audio API 实时生成
