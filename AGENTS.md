# AGENTS.md

这是 DeepSeek Harness 的第三方斗地主插件，不是 Harness 本体。别去改旁边的 `deepseek-harness` checkout。用法见 [README.md](README.md)。

Host 进程是权威房间和账本。`#/doudizhu` 只给房主本机 overlay。好友走 `/doudizhu/join`，不要启动官方 SPA。桌上的分是本机欢迎账本，不是 DeepSeek 余额，也别碰 API key。

## 目录

```
src/index.ts          Host apply：webServer + settings
src/config.ts         配置和默认经济
src/engine/           纯规则，不碰 IO
src/room/             房间状态机
src/net/              HTTP / WS / 加入页
src/settle/           账本、冻结、结算
src/persist/          存储 schema
src/client/           房主 overlay（factory-CJS）
src/join/             好友加入页（独立 IIFE）
types/shims/*.ts      给 typecheck 用的手写桩，不是真实运行时
scripts/              从官方复制的 client bundle 预设
lib/                  构建产物，不提交
```

## 命令

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm verify
```

`verify` = typecheck + build + test。`release:check` 还会校验 npm 包边界。CI 跑完还会 `git diff --exit-code`，别把构建产物留在工作区。未经用户明确授权，不推送、不发布 npm 包。

本地挂进 web profile：

```sh
dsh plugin --profile web add link:/绝对路径/dsh-doudizhu
```

改完重启 `dsh web`。

## 改代码时记住

- 源码只写 `.ts` / `.tsx`。不要手写运行用的 `.js`。
- `lib/` 和 `types/shims` 旁边的 `.d.ts` / `.js` / `.map` 都是产物。只提交手写的 `types/shims/*.ts` 和 `types/css-modules.d.ts`。
- 规则放 `src/engine`，权威状态放 Host。客户端不能自己裁定出牌或结算。
- 跨边界的积分用十进制字符串，内存里用 `bigint`。
- 浏览器 `lib/client.js` 必须是 factory-CJS：里面要有 `window.__ModuleLoader__.load`。朴素 ESM 装上会物化失败。
- `dsh.client.inject` 只给预检看，不要变成值导入。`ui-settings` 只能 `import type`。
- 读 `ctx.settingsScope` 之前，`inject` 里必须有 `settingsScope`。`sidebar.footer.action` / `shell.overlay` 用 `id`，`settings.plugin.item` 用 `key`。
- 平台模块（react、cordis、ui-slots、ui-primitives 等）当 external，名单在 `scripts/web-platform.ts`。
- 叫人只发 `/doudizhu/join?code=&invite=`。没配 `publicBaseUrl` 就不要假装能分享。
- 设置页改的是下次开房的默认值，已经开着的房间不要跟着变。

## 测试

单测按目录对着 `src/`。`tests/bundle/client-factory.spec.ts` 会查 `lib/client.js` 的 factory 形态，先 `pnpm build` 再跑 `pnpm test`，或者直接 `pnpm verify`。

跨机器加入不进 CI，本机步骤在 `tests/e2e/TUNNEL.md`。
