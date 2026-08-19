# dsh-poker

DeepSeek Harness 上的斗地主。你在自己电脑上开房，朋友点链接就能进来。3 人、4 人都行，经典和癞子都行。

桌上的分是这台机器自己记的，跟 DeepSeek 账户余额没关系。

## 安装

```sh
dsh plugin --profile web add dsh-poker
```

装完重启一下 `dsh web`。

本地改代码用：

```sh
dsh plugin --profile web add link:/绝对路径/dsh-doudizhu
```

## 怎么打

侧栏 New Session 下面点「斗地主」。首页有「创建 / 加入」两个 tab：自己开房填房间名、选人数和玩法；进别人的房填 6 位房号就行。人齐了自动开打，后来的人观战。定地主是叫地主 / 抢地主，每抢一次公共倍数 ×2，然后加倍、出牌。每手 120 秒，超时会帮你出最小单张或者过。

3 人一副牌，每人 17 张，3 张底牌。4 人两副牌，每人 25 张，8 张底牌。

## 叫人

要给别的电脑用，先去设置里填 `publicBaseUrl`，写成外面能访问到你这台 `dsh web` 的地址，比如 Cloudflare tunnel。填完房间里会给出一条链接，发给朋友就行。

朋友不用装插件，也不用自己跑 dsh。没填这个地址的话，只能自己再开几个标签页本机打。

别把带 `#/doudizhu` 的地址发出去，那个只有你自己电脑打得开。

## 设置

Settings → Plugins → dsh-poker

- **publicBaseUrl**：对外地址。空着就只能本机打
- **欢迎积分**：进房起始分，默认 200M
- **默认人数 / 倍数封顶 / 癞子**：只影响下次开房
- **旁观记牌器**：默认关

已经开着的房间不会跟着改。默认底注 1M、封顶 8，入座会冻一笔分，欢迎积分不够就开不了房。

## 开发

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm verify    # typecheck + build + test
```

从 GitHub 装源码要先开 `allowBuilds.dsh-poker: true`，安装时会跑构建编出 `lib/`。
