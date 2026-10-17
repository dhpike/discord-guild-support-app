# 燕云十六声帮会 Discord 支援 App

这是一个面向燕云十六声帮会 Discord 服务器的支援工具起点。它使用 Express 接收 Discord interactions，用 `discord-interactions` 校验请求签名，并通过 Discord HTTP API 注册 slash commands。

App 面向 Discord 用户的展示文案默认使用简体中文。

## 适合解决什么问题

- 帮会成员需要私密提交支援、纠纷、配装或活动问题。
- 管理组需要把请求整理到指定频道，而不是散落在聊天记录里。
- 帮会需要固定的新人指南、组队入口、配装库和资料搜索。
- 中英文成员混合时，需要快速做中文和英文互译。
- 想接入燕云十六声相关公开信息，但不想碰客户端逆向、外挂、宏或认证流量抓取。

## 已有功能

| 功能 | Discord 命令或接口 | 用途 |
| --- | --- | --- |
| 私密支援请求 | `/support` | 收集问题分类、紧急程度和说明，可投递到管理组频道 |
| 组队招募 | `/schedule` | 发布统一格式的招募，并在开始前 15 分钟通过 thread 提醒参与者 |
| 百业战语音提醒 | `/guildwar setup`、`/guildwar status`、`/guildwar stop` | 提前设置两队语音频道，开战后依次进入播报 |
| 帮会快捷指南 | `/wwm-guide` | 展示新人、活动、配装、支援等主题指南 |
| 活动草案 | `/event-plan` | 快速生成一条帮会活动安排草案 |
| 官方新闻 | `/news` | 读取繁体中文官方新闻、补丁和公告摘要 |
| Steam 数据 | `/steam status`、`/steam achievements` | 查看 Steam 在线人数和全局成就比例 |
| 百科搜索 | `/wiki` | 中文搜索游民星空攻略和 GameKee Wiki，英文搜索 Fandom Wiki |
| 表情包搜索 | `/meme` | 按描述搜索几个可选表情包图片 |
| 自动消息反应 | `/auto-reaction`、Gateway 配置 | 指定用户发消息时，bot 自动给该消息添加指定表情反应 |
| 中英文互译 | `/translate` | 在 Discord 内进行中英文互译，默认仅自己可见 |
| 翻译 HTTP 接口 | `POST /translate`、`POST /api/translate` | 给其他工具调用的中英文互译接口 |
| 成员档案 | `/profile set`、`/profile view` | 保存或查看成员角色、定位、武器和门派信息 |
| 组队 | `/lfg create`、`/lfg list` | 发布组队需求，成员可以点按钮加入 |
| 配装库 | `/build share`、`/build search` | 分享、搜索和点赞帮会配装 |
| 集成边界 | `/resources` | 说明当前安全数据来源和不建议接入的方式 |
| 在线状态说明 | `/presence-info` | 说明 Discord presence 跟踪需要的额外网关能力 |
| 功能想法 | `/use-cases` | 展示后续可以扩展的帮会场景 |

本地数据默认存储在 `.data/guild-support-store.json`。这适合早期原型和小规模测试；正式长期运行前建议迁移到 SQLite、Postgres、DynamoDB 或其他可靠数据库。

## 第一次启动

需要 Node.js `22.12.0` 或更高版本；生产环境建议使用 Node.js 24 LTS，以支持 Discord 当前的 DAVE 语音加密协议。

先复制环境变量模板：

```sh
cp .env.example .env
```

填写 `.env`：

```sh
APP_ID=<你的 Discord Application ID>
DISCORD_TOKEN=<你的 Discord Bot Token>
PUBLIC_KEY=<你的 Discord Application Public Key>
GUILD_ID=<你的测试服务器 ID>
SUPPORT_CHANNEL_ID=<管理组支援频道 ID>
GROUP_RECRUITING_CHANNEL_ID=<组队招募频道 ID，可选>
GROUP_RECRUITING_CHANNEL_NAME=group-recruiting
BAIYE_WARNING_AUDIO_FILE=<可选，自定义 48kHz、16-bit、双声道 PCM WAV>
BAIYE_DRAGON_WARNING_AUDIO_FILE=<可选，自定义大龙提醒 WAV，格式同上>
BAIYE_WARNING_GAIN=<可选，语音增益 1-4，默认 2.2>
GUILDWAR_CHANNEL_ONE_ID=<可选，默认进攻队语音频道 ID>
GUILDWAR_CHANNEL_TWO_ID=<可选，默认防守队语音频道 ID>
DATA_DIR=.data
WWM_OFFICIAL_NEWS_URL=https://www.wherewindsmeetgame.com/hmt/news/index.html
TRANSLATE_API_URL=<可选，兼容 LibreTranslate 的 /translate 接口地址>
TRANSLATE_API_KEY=<可选，翻译服务 API key>
MESSAGE_REACTION_USER_ID=<可选，目标用户 ID>
MESSAGE_REACTION_EMOJI=<可选，自动添加的表情，例如 🔥 或 <:name:id>>
MESSAGE_REACTION_CHANNEL_IDS=<可选，只在这些频道生效，多个频道用逗号分隔>
MESSAGE_REACTION_ADMIN_ROLE_ID=<可选，允许编辑自动反应规则的角色 ID>
```

安装依赖：

```sh
npm install
```

注册 Discord 命令：

```sh
npm run register
```

启动本地服务：

```sh
npm run dev
```

默认服务地址是：

```text
http://localhost:3000
```

健康检查：

```sh
curl http://localhost:3000/healthz
```

正常会返回：

```json
{"ok":true}
```

## Discord Developer Portal 设置

创建 Discord application 后，把 bot 安装到你的帮会服务器。至少需要：

- `applications.commands`
- `bot`

如果你配置了 `SUPPORT_CHANNEL_ID`，bot 需要能在那个频道发送消息。

`/schedule` 优先使用 `GROUP_RECRUITING_CHANNEL_ID`；未配置时会自动寻找 `GROUP_RECRUITING_CHANNEL_NAME` 指定的文字频道。bot 需要在该频道拥有 `View Channel`、`Read Message History`、`Send Messages`、`Create Public Threads` 和 `Send Messages in Threads` 权限；建议同时授予 `Manage Threads`，以便取消活动时删除对应 thread。

`/guildwar setup` 默认使用“百业战进攻队”和“百业战防守队”两个普通语音频道，也可以用 `channel_one` 和 `channel_two` 手动覆盖。bot 需要在两个频道都拥有 `View Channel`、`Connect` 和 `Speak` 权限。这个功能使用普通的 `GUILDS` 和 `GUILD_VOICE_STATES` intents，不需要开启特权 intent。仓库已包含野怪和大龙两种中文 WAV；每次提醒会使用软限幅增益连续播放两遍。可以通过 `BAIYE_WARNING_AUDIO_FILE` 和 `BAIYE_DRAGON_WARNING_AUDIO_FILE` 换成同格式音频，或用 `BAIYE_WARNING_GAIN` 在 1-4 之间调节增益。指令回复为仅执行者可见。

如果你配置了自动消息反应，bot 还需要在目标频道拥有：

- `View Channel`
- `Read Message History`
- `Add Reactions`

这个功能通过 Discord Gateway 接收 `MESSAGE_CREATE` 事件，只需要普通的 `GUILDS` 和 `GUILD_MESSAGES` intents；当前实现不读取消息正文，因此不需要开启 `MESSAGE_CONTENT` 特权 intent。

如果配置了 `MESSAGE_REACTION_ADMIN_ROLE_ID`，只有该身份组成员可以使用 `/auto-reaction set`、`/auto-reaction add` 和 `/auto-reaction clear` 修改规则。

开发期建议用 ngrok 或类似工具暴露本地端口：

```sh
ngrok http 3000
```

然后在 Discord Developer Portal 里设置 Interactions Endpoint URL：

```text
https://<your-tunnel-host>/interactions
```

如果设置了 `GUILD_ID`，`npm run register` 会注册 guild-scoped commands，通常几秒内生效，适合开发调试。如果不设置 `GUILD_ID`，命令会注册成 global commands，适合功能稳定后使用，但生效可能更慢。

## 常用命令示例

提交私密支援请求：

```text
/support category:配装 details:我想优化 PvE 输出循环 urgency:普通
```

发布组队招募：

```text
/schedule time:明晚十点 zone:美东 activity:五人竞速
```

bot 会在 `#group-recruiting` 发布：

```text
招募：五人竞速
时间：8/6/2026 周四 晚上 10:00（美东）
发起人：@发起人

👇 有意参加？请点击下方 👍 或任意表情报名！
```

`zone` 为必填项，支持美东、美西、美中、美山、加东、加西、加中，以及 ET、PT、CT、MT 等常用缩写。

`time` 必须包含具体时刻，例如“明晚十点”“后天20:00”“这周日晚9点”或“十月一号晚9点”，并且活动时间必须晚于发布时刻。招募发布后，bot 会立即在消息下创建 thread；活动开始前 15 分钟，再在该 thread 中发送“时间差不多咯！”并提醒原发起人和所有给招募消息添加过 reaction 的非 bot 用户。重复添加不同 reaction 的成员只会被提醒一次；服务重启不会清除尚未触发的提醒。

需要取消时，在 Discord 打开 `User Settings` → `Advanced` → 开启 `Developer Mode`，然后右键招募消息并选择 `Copy Message ID`：

```text
/cancel message_id:1534651572061999304
```

只有原发起人可以取消，bot 会从 `#group-recruiting` 撤回对应消息，并删除该消息创建的 thread。

提前设置百业战语音提醒：

```text
/guildwar setup start_in_minutes:1:29
```

`1:29` 表示 1 分 29 秒后开战；纯数字按分钟计算，例如 `10` 表示 10 分钟。如需要手动换频道，再填写可选的 `channel_one` 和 `channel_two`。

已经开战时，按游戏内显示的剩余倒计时设置：

```text
/guildwar setup remaining_time:24:30
```

`remaining_time` 表示距离战斗结束还剩多久，不是已经打了多久；支持分钟或 `分:秒`，必须大于 0 且不超过 `30:00`。它和 `start_in_minutes` 必须二选一。Bot 会接续剩余计时，仅安排尚未错过的野怪和大龙提醒，不补播过去的提醒。默认频道、双播和先后进入两队的规则相同。已有计时时，先由设置者或管理员执行 `/guildwar stop`，再重新设置；Bot 重启后也可以用游戏内剩余时间恢复提醒。

Bot 会先等待指定的开战时间（上例为 1 分 29 秒），开战时从 30 分钟开始倒计时。在第 5、10、15、20、25 分钟刷新前 35 秒，Bot 会进入一队频道大音量连续播报两遍并退出，然后立即进入二队频道播放两遍并退出。倒计时剩余 17:05 和 16:05 时，也会按相同频道顺序各播放两遍“大龙即将刷新！请多注意播报和小地图！”。二队不再使用独立计时。第 30 分钟结束时不播报。

查看倒计时或停止提醒：

```text
/guildwar status
/guildwar stop
```

每个服务器同时只能有一个百业战提醒。同一个 Bot 账号不能同时加入两个语音频道，因此两队播报会严格串行；如果第一队播报超时，第二队会在第一队退出后立即播报。只有设置者或拥有 `Manage Server` / `Administrator` 权限的人可以停止。当前倒计时保存在进程内；如果服务在开战前或活动中重启，需要重新执行 `/guildwar setup`。

查看帮会指南：

```text
/wwm-guide topic:新人指南
```

生成活动草案：

```text
/event-plan activity:据点争夺 time:周六 20:00 notes:需要治疗和指挥提前到场
```

查看官方新闻：

```text
/news
```

查看 Steam 在线人数：

```text
/steam topic:status
```

搜索 Wiki：

```text
/wiki query:凌云踏
```

英文关键词会继续查 Fandom：

```text
/wiki query:merchant
```

搜索表情包，默认只有自己可见：

```text
/meme query:猫猫无语
```

结果只显示候选图片和编号按钮。每次会从同一关键词的前若干候选中随机抽取几张，所以重复搜索同一个关键词时可能看到不同候选，但不会改变关键词本身。确认某个候选适合当前频道后，点编号即可把该图片作为新的频道消息单独发送，不会引用候选预览消息。

公开发送表情包候选：

```text
/meme query:笑死 public:true
```

指定用户发消息时自动加表情反应：

```sh
MESSAGE_REACTION_USER_ID=123456789012345678
MESSAGE_REACTION_EMOJI=🔥
```

只在某些频道生效：

```sh
MESSAGE_REACTION_CHANNEL_IDS=111111111111111111,222222222222222222
```

多个用户或多个表情规则：

```sh
MESSAGE_REACTION_RULES='[{"userId":"123456789012345678","emoji":"👍"},{"userId":"234567890123456789","emoji":"<:wwm:123456789012345678>"}]'
```

配置后重启服务即可生效。自定义表情可以写成 Discord 复制出来的 `<:name:id>` / `<a:name:id>`，也可以写成 API 需要的 `name:id`。

也可以让有权限的指挥在 Discord 内编辑。这里仅填写服务器自定义表情名称，应用会在后台解析对应 ID：

```text
/auto-reaction set user_id:1017955151765573723 emoji_name:lubian
/auto-reaction add user_id:1017955151765573723 emoji_name:13421142546174839
/auto-reaction view
/auto-reaction clear user_id:1017955151765573723 emoji_name:lubian
```

中英文互译，默认只有自己可见：

```text
/translate text:Need help with a build target:翻译成中文
```

公开发送翻译结果：

```text
/translate text:今晚八点集合 target:翻译成英文 public:true
```

保存成员档案：

```text
/profile set character:角色名 role:输出 weapons:剑/伞 sect:门派
```

创建组队：

```text
/lfg create activity:副本 title:今晚副本开荒 size:6 notes:缺治疗
```

分享配装：

```text
/build share title:PvE 输出配装 role:输出 weapons:剑 notes:适合新手过渡
```

## 翻译接口

Discord `/translate` 和 HTTP `POST /translate` 都走同一个翻译封装。

如果源语言和目标语言相同，接口会直接返回原文，不调用外部服务。如果需要真正跨语言翻译，需要设置 `TRANSLATE_API_URL`。当前实现兼容 LibreTranslate 风格的接口，请求体会发送：

```json
{
  "q": "Need help with a build",
  "source": "en",
  "target": "zh",
  "format": "text",
  "api_key": "<可选>"
}
```

调用本地 HTTP 接口：

```sh
curl -X POST http://localhost:3000/translate \
  -H 'Content-Type: application/json' \
  -d '{"text":"Need help with a build","target":"zh"}'
```

也可以使用兼容别名：

```sh
curl -X POST http://localhost:3000/api/translate \
  -H 'Content-Type: application/json' \
  -d '{"text":"今晚八点集合","target":"en"}'
```

支持的语言参数：

- 中文：`zh`、`zh-cn`、`chinese`、`中文`
- 英文：`en`、`english`、`英文`

## 安全集成边界

当前项目只使用安全的只读或用户提交数据：

- 官方网站公开新闻。
- Steam Web API 的公开统计。
- 游民星空中文攻略搜索。
- GameKee 中文 Wiki 搜索。
- Fandom Wiki 英文搜索。
- 斗图啦公开表情包搜索。
- Discord Gateway 的 `MESSAGE_CREATE` 事件，用于指定用户消息的自动表情反应。
- Discord interactions、按钮、表单和你自己服务器内的数据。
- 成员手动维护的档案、组队和配装。
- 可选的第三方翻译服务。

不要接入这些方式：

- 逆向游戏客户端。
- 抓取认证后的游戏流量。
- 读取进程内存或本地缓存。
- 宏、脚本、外挂、自动按键。
- 模拟玩家操作。
- 未经授权抓取账号、角色、排行榜或交易数据。

这些方向有明显封号、条款和社区信任风险，也不适合作为帮会公共工具。

## 常见问题

### `/interactions` 返回 `discord_public_key_missing`

说明 `.env` 里没有配置 `PUBLIC_KEY`。服务仍然可以启动，`/healthz` 和翻译 HTTP 接口也能用，但 Discord interactions 无法校验签名。到 Discord Developer Portal 复制 application public key 后重启服务。

### `/support` 没有发到管理频道

检查：

- `.env` 是否配置了 `SUPPORT_CHANNEL_ID`。
- `.env` 是否配置了 `DISCORD_TOKEN`。
- bot 是否在目标频道有发送消息权限。

### `/translate` 提示翻译服务尚未配置

同语言翻译会直接返回原文；跨语言翻译需要配置 `TRANSLATE_API_URL`。你可以接入自托管 LibreTranslate 或其他兼容 `POST /translate` 请求格式的服务。

### 命令注册后 Discord 看不到

开发期建议配置 `GUILD_ID` 后运行：

```sh
npm run register
```

guild commands 通常更快生效。global commands 可能需要更久。

## 开发命令

运行测试：

```sh
npm test
```

检查 JavaScript 语法：

```sh
npm run check
```

注册 slash commands：

```sh
npm run register
```

启动服务：

```sh
npm run dev
```

## 项目结构

```text
src/app.js                         Express app、健康检查、翻译 HTTP 接口、Discord interactions endpoint
src/baiye-voice.js                百业战倒计时、Discord 语音连接和 PCM 播报
src/commands.js                    Slash command 定义和注册入口
src/interactions.js                命令、按钮和 modal 的路由
src/storage.js                     成员档案、组队和配装的本地 JSON 存储
src/integrations/official-news.js  官方新闻解析
src/integrations/steam.js          Steam 公开统计
src/integrations/translate.js      中英文翻译服务封装
src/integrations/wiki.js           游民星空、GameKee 与 Fandom 搜索
src/integrations/meme-stickers.js  斗图啦表情包搜索
src/support.js                     支援请求解析和格式化
src/views.js                       Discord 响应内容生成
src/where-winds-meet.js            燕云十六声帮会选项、指南和中文标签
docs/integrations.md               集成说明和安全边界
docs/use-cases.md                  后续功能想法
test/*.test.js                     Node 内置测试
```

## 下一步 TODO

1. 把 `.data` 本地 JSON 存储迁移到 SQLite 或 Postgres。
2. 给 `/support` 增加工单状态、负责人、关闭原因和历史查询。
3. 给 `/lfg` 增加自动提醒、活动时间解析和日历视图。
4. 给 `/build` 增加分类筛选、版本标签和导师点评。
5. 增加管理组招募、纠纷处理和每周摘要命令。
6. 如确实需要在线状态，新增 Discord Gateway worker，并申请或开启 `GUILD_PRESENCES` intent。
7. 为官方新闻解析增加缓存和结构变化告警。
8. 为翻译服务增加 provider 配置文档和失败重试策略。
9. 部署到长期运行环境，例如 Fly.io、Render、Railway、VPS 或自己的容器平台。
10. 增加权限控制，限制管理命令只能被指定身份组使用。
