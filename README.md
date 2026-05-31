# SG-QuickJoin

[中文](#中文) | [English](#english)

---

## 中文

### 概述

**SG-QuickJoin** 是一个基于 [Tampermonkey](https://www.tampermonkey.net/) 的用户脚本，为 [SteamGifts.com](https://www.steamgifts.com/) 上的每个抽奖添加**一键"Join / Leave"按钮**。你无需逐个进入抽奖页面点击"Enter Giveaway"，直接从抽奖列表即可参与；对于已加入的抽奖，也可以一键退出——节省时间的同时，每次操作仍需要手动点击。

### 开发起因

2026年5月，SteamGifts [官方宣布](https://www.steamgifts.com/discussion/M9UFV/upcoming-autojoin-suspensions)：从 **2026年6月1日** 起，任何安装了 **AutoJoin** 浏览器扩展的账号将被**暂停使用**。

**SG-QuickJoin 不是自动参与工具。** 它不会自动加入抽奖。它只是在列表页的每个抽奖项旁添加一个方便的"Join"按钮，让你一键参与，省去以下重复步骤：

1. 点击抽奖标题进入详情页
2. 找到"Enter Giveaway"按钮
3. 点击按钮
4. 返回列表页
5. 对每个抽奖重复以上操作

使用 SG-QuickJoin，每次参与仍需要**你手动点击**——它在尊重公平竞争精神的同时，消除了重复的页面导航。

### 功能特性

- 🖱️ **一键参与 / 退出** — 直接从抽奖列表加入任意抽奖，也可一键退出已参与的抽奖
- 💰 **积分感知** — 自动检测积分是否足够；积分不足时自动禁用按钮
- 🔄 **实时积分同步** — 每次成功参与或退出后自动更新显示积分
- 🚦 **智能按钮状态** — 针对加载中、已加入（显示Leave）、退出中、积分不足、错误等状态提供视觉反馈
- 🔒 **顺序请求** — 同一时间仅发送一个请求，避免触发频率限制
- 📌 **固定导航栏** — 滚动页面时保持 SteamGifts 导航栏（积分）可见

### 安装方法

1. 在浏览器中直接打开该文件的[原始链接](dist/sg-quickjoin.user.js?raw=true)——Tampermonkey 会自动检测并提示安装

或者

1. 为你的浏览器安装 [Tampermonkey](https://www.tampermonkey.net/)
2. 打开 [dist/sg-quickjoin.user.js](dist/sg-quickjoin.user.js?raw=true) 文件
3. 复制其内容，在 Tampermonkey 中创建新脚本并粘贴

---

## English

### Overview

**SG-QuickJoin** is a [Tampermonkey](https://www.tampermonkey.net/) userscript that adds a **one-click "Join / Leave" button** to each giveaway on [SteamGifts.com](https://www.steamgifts.com/). Instead of navigating into each giveaway page individually to click "Enter Giveaway", you can join directly from the giveaway list. You can also **leave** giveaways you've already entered with one click — saving time while still requiring manual interaction for each action.

### Why This Project Exists

On May 2026, SteamGifts [announced](https://www.steamgifts.com/discussion/M9UFV/upcoming-autojoin-suspensions) that beginning **June 1st, 2026**, any account accessing the site with the **AutoJoin** browser extension installed would be **suspended**.

**SG-QuickJoin is NOT an auto-join tool.** It does not automatically enter giveaways. It simply adds a convenient "Join" button to each giveaway row on the list page, so you can join with one click instead of:

1. Clicking the giveaway title to open its page
2. Finding the "Enter Giveaway" button
3. Clicking it
4. Going back to the list
5. Repeating for every giveaway

With SG-QuickJoin, each entry still requires **your manual click** — it respects the spirit of fair play while eliminating repetitive page navigation.

### Features

- 🖱️ **One-click join / leave** — Join any giveaway directly from the giveaway list, or leave giveaways you've already entered
- 💰 **Points-aware** — Automatically checks if you have enough points; disables the button if you don't
- 🔄 **Live points sync** — Updates your displayed points after each successful join or leave
- 🚦 **Smart button states** — Visual feedback for loading, entered (Leave), leaving, insufficient points, and error states
- 🔒 **Sequential requests** — Only one request at a time to avoid rate-limiting
- 📌 **Fixed header** — Keeps the SteamGifts navigation bar (points) visible while scrolling

### Installation

1. Open the [raw file](dist/sg-quickjoin.user.js?raw=true) in your browser — Tampermonkey should detect and offer to install it

Or

1. Install [Tampermonkey](https://www.tampermonkey.net/) for your browser
2. Open the [dist/sg-quickjoin.user.js](dist/sg-quickjoin.user.js) file
3. Copy its contents, create a new Tampermonkey script, and paste

---

## License

MIT
