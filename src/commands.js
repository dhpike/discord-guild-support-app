import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { CommandOptionType, CommandType, InstallationContext, InteractionContext } from './constants.js';
import { installCommands } from './discord.js';
import {
  buildRoleChoices,
  eventActivityChoices,
  guideTopics,
  lfgActivityChoices,
  roleChoices,
  supportCategories,
  urgencyChoices,
} from './where-winds-meet.js';
import { translateTargets } from './integrations/translate.js';

const guildCommandContext = {
  integration_types: [InstallationContext.GUILD_INSTALL],
  contexts: [InteractionContext.GUILD],
};

function toChoice({ name, value }) {
  return { name, value };
}

export const SUPPORT_COMMAND = {
  name: 'support',
  description: '提交私密帮会支援请求',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
  options: [
    {
      type: CommandOptionType.STRING,
      name: 'category',
      description: '你需要哪类帮助？',
      required: true,
      choices: supportCategories.map(toChoice),
    },
    {
      type: CommandOptionType.STRING,
      name: 'details',
      description: '给管理组看的简短说明；留空会弹出表单',
      required: false,
      min_length: 10,
      max_length: 1200,
    },
    {
      type: CommandOptionType.STRING,
      name: 'urgency',
      description: '紧急程度',
      required: false,
      choices: urgencyChoices,
    },
  ],
};

export const SCHEDULE_COMMAND = {
  name: 'schedule',
  description: '发布一条格式统一的组队招募',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
  options: [
    {
      type: CommandOptionType.STRING,
      name: 'time',
      description: '必须含具体时刻，例如：明晚十点，后天20:00，这周日晚9点',
      required: true,
      min_length: 2,
      max_length: 100,
    },
    {
      type: CommandOptionType.STRING,
      name: 'zone',
      description: '时区，例如：美东，美西，美中，加东，加西',
      required: true,
      min_length: 2,
      max_length: 30,
    },
    {
      type: CommandOptionType.STRING,
      name: 'activity',
      description: '招募活动，例如：五人竞速，十人竞速，群策，演武',
      required: true,
      min_length: 1,
      max_length: 100,
    },
  ],
};

export const CANCEL_COMMAND = {
  name: 'cancel',
  description: '取消自己通过 /schedule 发布的招募',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
  options: [{
    type: CommandOptionType.STRING,
    name: 'message_id',
    description: '招募消息的 Message ID',
    required: true,
    min_length: 17,
    max_length: 22,
  }],
};

export const GUILDWAR_COMMAND = {
  name: 'guildwar',
  description: '设置百业战语音刷新提醒',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
  options: [
    {
      type: CommandOptionType.SUB_COMMAND,
      name: 'setup',
      description: '选择两队语音频道，设置开战前等待或开战后的剩余时间',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'start_in_minutes',
          description: '开战前填写：距离开战的分钟或分:秒，如 1:29；与 remaining_time 二选一',
          required: false,
          min_length: 1,
          max_length: 6,
        },
        {
          type: CommandOptionType.STRING,
          name: 'remaining_time',
          description: '开战后填写：游戏内剩余倒计时，如 24:30；与 start_in_minutes 二选一',
          required: false,
          min_length: 1,
          max_length: 6,
        },
        {
          type: CommandOptionType.CHANNEL,
          name: 'channel_one',
          description: '可选，默认百业战进攻队',
          required: false,
          channel_types: [2],
        },
        {
          type: CommandOptionType.CHANNEL,
          name: 'channel_two',
          description: '可选，默认百业战防守队',
          required: false,
          channel_types: [2],
        },
      ],
    },
    {
      type: CommandOptionType.SUB_COMMAND,
      name: 'status',
      description: '查看距离开战或结束还剩多久',
    },
    {
      type: CommandOptionType.SUB_COMMAND,
      name: 'stop',
      description: '取消等待或停止当前百业战提醒',
    },
  ],
};

export const WWM_GUIDE_COMMAND = {
  name: 'wwm-guide',
  description: '显示燕云十六声帮会快捷指南',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
  options: [
    {
      type: CommandOptionType.STRING,
      name: 'topic',
      description: '指南主题',
      required: false,
      choices: Object.entries(guideTopics).map(([value, topic]) => ({
        name: topic.title,
        value,
      })),
    },
  ],
};

export const EVENT_PLAN_COMMAND = {
  name: 'event-plan',
  description: '生成一条帮会活动草案',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
  options: [
    {
      type: CommandOptionType.STRING,
      name: 'activity',
      description: '活动类型',
      required: true,
      choices: eventActivityChoices,
    },
    {
      type: CommandOptionType.STRING,
      name: 'time',
      description: '时间和时区，例如 周日 19:00 PT',
      required: true,
      max_length: 100,
    },
    {
      type: CommandOptionType.STRING,
      name: 'note',
      description: '补充说明',
      required: false,
      max_length: 600,
    },
  ],
};

export const NEWS_COMMAND = {
  name: 'news',
  description: '查看官方新闻、补丁和公告',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
};

export const STEAM_COMMAND = {
  name: 'steam',
  description: '查看燕云十六声 Steam 数据',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
  options: [
    {
      type: CommandOptionType.STRING,
      name: 'topic',
      description: '要查看的数据',
      required: true,
      choices: [
        { name: '在线人数', value: 'status' },
        { name: '全局成就', value: 'achievements' },
      ],
    },
  ],
};

export const WIKI_COMMAND = {
  name: 'wiki',
  description: '搜索燕云十六声中英文百科资料',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
  options: [
    {
      type: CommandOptionType.STRING,
      name: 'query',
      description: '搜索关键词',
      required: true,
      min_length: 2,
      max_length: 80,
    },
  ],
};

export const MEME_COMMAND = {
  name: 'meme',
  description: '搜索表情包候选',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
  options: [
    {
      type: CommandOptionType.STRING,
      name: 'query',
      description: '表情包描述，例如 猫猫无语 / 笑死 / 加班',
      required: true,
      min_length: 1,
      max_length: 80,
    },
    {
      type: CommandOptionType.BOOLEAN,
      name: 'public',
      description: '是否公开发送到当前频道，默认仅自己可见',
      required: false,
    },
  ],
};

export const TRANSLATE_COMMAND = {
  name: 'translate',
  description: '中英文互译',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
  options: [
    {
      type: CommandOptionType.STRING,
      name: 'text',
      description: '要翻译的文本',
      required: true,
      min_length: 1,
      max_length: 1800,
    },
    {
      type: CommandOptionType.STRING,
      name: 'target',
      description: '目标语言',
      required: true,
      choices: translateTargets,
    },
    {
      type: CommandOptionType.BOOLEAN,
      name: 'public',
      description: '是否公开发送到当前频道，默认仅自己可见',
      required: false,
    },
  ],
};

export const PROFILE_COMMAND = {
  name: 'profile',
  description: '创建或查看帮会成员档案',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
  options: [
    {
      type: CommandOptionType.SUB_COMMAND,
      name: 'set',
      description: '保存你的角色档案',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'character',
          description: '游戏内角色名',
          required: true,
          max_length: 80,
        },
        {
          type: CommandOptionType.STRING,
          name: 'role',
          description: '常用定位',
          required: false,
          choices: roleChoices,
        },
        {
          type: CommandOptionType.STRING,
          name: 'weapons',
          description: '常用武器，例如 剑/伞',
          required: false,
          max_length: 120,
        },
        {
          type: CommandOptionType.STRING,
          name: 'inner_ways',
          description: '常用心法',
          required: false,
          max_length: 180,
        },
        {
          type: CommandOptionType.STRING,
          name: 'sect',
          description: '门派或流派',
          required: false,
          max_length: 80,
        },
        {
          type: CommandOptionType.STRING,
          name: 'server',
          description: '服务器或区服',
          required: false,
          max_length: 80,
        },
        {
          type: CommandOptionType.STRING,
          name: 'timezone',
          description: '常用时区，例如 PT / ET / GMT+8',
          required: false,
          max_length: 40,
        },
      ],
    },
    {
      type: CommandOptionType.SUB_COMMAND,
      name: 'view',
      description: '查看自己的角色档案',
    },
  ],
};

export const LFG_COMMAND = {
  name: 'lfg',
  description: '创建或查看帮会组队',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
  options: [
    {
      type: CommandOptionType.SUB_COMMAND,
      name: 'create',
      description: '发起一个组队',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'activity',
          description: '玩法类型',
          required: true,
          choices: lfgActivityChoices,
        },
        {
          type: CommandOptionType.STRING,
          name: 'time',
          description: '时间，例如 今天 21:00 PT',
          required: true,
          max_length: 100,
        },
        {
          type: CommandOptionType.STRING,
          name: 'note',
          description: '要求或备注',
          required: false,
          max_length: 500,
        },
      ],
    },
    {
      type: CommandOptionType.SUB_COMMAND,
      name: 'list',
      description: '查看开放中的组队',
    },
  ],
};

export const BUILD_COMMAND = {
  name: 'build',
  description: '分享或搜索帮会配装',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
  options: [
    {
      type: CommandOptionType.SUB_COMMAND,
      name: 'share',
      description: '分享一套配装',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'name',
          description: '配装名称',
          required: true,
          max_length: 80,
        },
        {
          type: CommandOptionType.STRING,
          name: 'weapon',
          description: '核心武器或武器组合',
          required: true,
          max_length: 120,
        },
        {
          type: CommandOptionType.STRING,
          name: 'role',
          description: '定位',
          required: true,
          choices: buildRoleChoices,
        },
        {
          type: CommandOptionType.STRING,
          name: 'inner_ways',
          description: '心法组合',
          required: false,
          max_length: 180,
        },
        {
          type: CommandOptionType.STRING,
          name: 'notes',
          description: '手法、适用玩法、优缺点或链接',
          required: false,
          max_length: 800,
        },
      ],
    },
    {
      type: CommandOptionType.SUB_COMMAND,
      name: 'search',
      description: '搜索帮会配装',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'query',
          description: '关键词，例如 伞 治疗 PVP',
          required: false,
          max_length: 80,
        },
      ],
    },
  ],
};

export const RESOURCES_COMMAND = {
  name: 'resources',
  description: '查看安全数据来源和集成边界',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
};

export const PRESENCE_INFO_COMMAND = {
  name: 'presence-info',
  description: '查看 Discord 在线状态跟踪接入说明',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
};

export const USE_CASES_COMMAND = {
  name: 'use-cases',
  description: '列出未来可扩展的帮会应用功能',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
};

export const AUTO_REACTION_COMMAND = {
  name: 'auto-reaction',
  description: '管理指定用户消息的自动表情反应',
  type: CommandType.CHAT_INPUT,
  ...guildCommandContext,
  options: [
    {
      type: CommandOptionType.SUB_COMMAND,
      name: 'set',
      description: '替换自动反应规则，仅限指挥编辑',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'user_id',
          description: '目标用户 ID',
          required: true,
          min_length: 17,
          max_length: 22,
        },
        {
          type: CommandOptionType.STRING,
          name: 'emoji_name',
          description: '服务器自定义表情名称，例如 lubian',
          required: true,
          min_length: 1,
          max_length: 80,
        },
        {
          type: CommandOptionType.STRING,
          name: 'channel_ids',
          description: '可选，限定频道 ID，多个用逗号分隔',
          required: false,
          max_length: 600,
        },
      ],
    },
    {
      type: CommandOptionType.SUB_COMMAND,
      name: 'add',
      description: '新增一条自动反应规则，仅限指挥编辑',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'user_id',
          description: '目标用户 ID',
          required: true,
          min_length: 17,
          max_length: 22,
        },
        {
          type: CommandOptionType.STRING,
          name: 'emoji_name',
          description: '服务器自定义表情名称，例如 lubian',
          required: true,
          min_length: 1,
          max_length: 80,
        },
        {
          type: CommandOptionType.STRING,
          name: 'channel_ids',
          description: '可选，限定频道 ID，多个用逗号分隔',
          required: false,
          max_length: 600,
        },
      ],
    },
    {
      type: CommandOptionType.SUB_COMMAND,
      name: 'view',
      description: '查看当前自动反应规则',
    },
    {
      type: CommandOptionType.SUB_COMMAND,
      name: 'clear',
      description: '清除一条自动反应规则，仅限指挥编辑',
      options: [
        {
          type: CommandOptionType.STRING,
          name: 'user_id',
          description: '目标用户 ID',
          required: true,
          min_length: 17,
          max_length: 22,
        },
        {
          type: CommandOptionType.STRING,
          name: 'emoji_name',
          description: '要清除的服务器自定义表情名称，例如 lubian',
          required: true,
          min_length: 1,
          max_length: 80,
        },
        {
          type: CommandOptionType.STRING,
          name: 'channel_ids',
          description: '可选，限定频道 ID，必须和原规则一致',
          required: false,
          max_length: 600,
        },
      ],
    },
  ],
};

export const ALL_COMMANDS = [
  SUPPORT_COMMAND,
  SCHEDULE_COMMAND,
  CANCEL_COMMAND,
  GUILDWAR_COMMAND,
  WWM_GUIDE_COMMAND,
  EVENT_PLAN_COMMAND,
  NEWS_COMMAND,
  STEAM_COMMAND,
  WIKI_COMMAND,
  MEME_COMMAND,
  TRANSLATE_COMMAND,
  PROFILE_COMMAND,
  LFG_COMMAND,
  BUILD_COMMAND,
  RESOURCES_COMMAND,
  PRESENCE_INFO_COMMAND,
  USE_CASES_COMMAND,
  AUTO_REACTION_COMMAND,
];

export function commandsForScope(guildId) {
  if (!guildId) {
    return ALL_COMMANDS;
  }

  return ALL_COMMANDS.map(({ contexts, integration_types, ...command }) => command);
}

export async function registerCommands() {
  const guildId = process.env.GUILD_ID || undefined;
  const commands = commandsForScope(guildId);
  await installCommands(process.env.APP_ID, commands, guildId);
  const scope = guildId ? `guild ${guildId}` : 'global';
  console.log(`Registered ${commands.length} commands for ${scope}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  registerCommands().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
