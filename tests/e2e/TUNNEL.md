# Named tunnel 手工验收

CI 不跑公网。本机验证跨机器加入：

1. 起一个支持 WebSocket upgrade 的 named tunnel / 反代，指到 `dsh web` 的 loopback 端口。
2. 在插件设置填写 `publicBaseUrl` 为该 origin（无尾斜杠）。
3. 侧栏创建房间，复制 `/doudizhu/join?code=&invite=` 链接。
4. 好友需要已安装 DeepSeek Harness 和本插件。打开链接后：缺任何一项会看到安装说明（DSH 官网 + GitHub 仓库）；两项都有则停在门槛页，点「进入」才进 `#/doudizhu` tab 入座或旁观。
5. 若隧道不透 WebSocket，斗地主 tab 会自动降级为 `GET /doudizhu/api/rooms/:id/since?seq=` 轮询。
