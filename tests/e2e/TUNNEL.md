# Named tunnel 手工验收

CI 不跑公网。本机验证跨机器加入：

1. 起一个支持 WebSocket upgrade 的 named tunnel / 反代，指到 `dsh web` 的 loopback 端口。
2. 在插件设置填写 `publicBaseUrl` 为该 origin（无尾斜杠）。
3. 侧栏创建房间，复制 `/doudizhu/join?code=&invite=` 链接（不要分享 `#/doudizhu`）。
4. 好友用普通浏览器打开加入页，入座或旁观。
5. 若隧道不透 WebSocket，加入页会自动降级为 `GET /doudizhu/api/rooms/:id/since?seq=` 轮询。
