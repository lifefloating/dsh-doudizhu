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

侧栏 New Session 下面点 dsh-poker。创建、加入、打牌都留在这个 tab，不会另开页面。

**开房 / 进房**

首页有「创建 / 加入」两个分栏：

- **创建**：填房间名，选人数和玩法
- **加入**：填 6 位房号，先看房间信息再点确定

3 人一副牌，每人 17 张，3 张底牌。4 人两副牌，每人 25 张，8 张底牌。

**准备**

进桌后好友点黄色准备，齐了由房主开打。准备阶段房主可以踢人。后来的人观战。

**叫抢和加倍**

定地主是欢乐斗地主那套：

- 叫地主 / 抢地主，每人一次
- 不叫的人不能抢
- 最后抢的人当地主
- 每抢一次公共倍数 ×2

然后加倍、出牌。加倍按钮点完就收起，不用等其他人。

**出牌**

别人头像上方会标「出牌中…」，轮到你时中间闪一下「轮到你出牌了~」。

每手默认 120 秒，设置里可改 60–300 秒。超时进入托管：能压就出最小合法牌型，不能压再过；叫抢阶段默认不叫 / 不抢。之后该座位大约 1.5 秒走一步。点一次牌或按钮就退出托管。对局不会因为倒计时结束而关闭。闲着不出牌不会被标成离线。

**座位**

- 准备阶段关掉标签会让出座位（没准备或已准备都一样），不再占名额
- 对局中途关掉标签才显示离线并进入托管
- 同一个浏览器只能进一次这个房间；再开标签会提示已经在房间里，换一个浏览器才算另一人

## 叫人

要给别的电脑用，先去设置里填 `publicBaseUrl`，写成外面能访问到你这台 `dsh web` 的地址，比如 Cloudflare tunnel。填完房间里会给出一条链接，发给朋友就行。

朋友要点开链接，也需要自己有 [DeepSeek Harness](https://www.deepseek.com/harness)，并且安装了本插件：

```sh
dsh plugin --profile web add dsh-poker
```

装完重启 `dsh web`。仓库在 [github.com/lifefloating/dsh-doudizhu](https://github.com/lifefloating/dsh-doudizhu)。缺 DSH 或插件时，邀请页会直接写明怎么装，并带上这两个链接。两项都有时，点「进入」才进去，不会自动跳。

没填 `publicBaseUrl` 的话，只能自己再开几个 DSH 标签点 dsh-poker 填房号。

## 设置

Settings → Plugins → dsh-poker

- **publicBaseUrl**：对外地址。空着就只能本机打
- **欢迎积分**：进房起始分，默认 200M
- **默认人数 / 倍数封顶 / 癞子**：只影响下次开房
- **出牌计时**：叫抢和出牌共用，默认 120 秒，最少 60、最多 300。空着按默认
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

---

## 🌟 Special Thanks

<p align="center">
  <a href="https://linux.do">
    <img src="docs/images/linuxdo.png" alt="LINUX DO" width="420" />
  </a>
</p>
<p align="center"><b>For all things AI, head to LINUX DO! Wishing the community ever greater success~</b></p>

---

