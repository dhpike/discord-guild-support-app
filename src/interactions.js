import { InteractionResponseType, InteractionType } from './constants.js';
import { fetchOfficialNews } from './integrations/official-news.js';
import {
  fetchSteamAchievementPercentages,
  fetchSteamCurrentPlayers,
} from './integrations/steam.js';
import { searchWiki } from './integrations/wiki.js';
import {
  consumeMemeCandidate,
  rememberMemeCandidates,
  searchMemeStickers,
} from './integrations/meme-stickers.js';
import { translateText } from './integrations/translate.js';
import {
  addMessageReaction,
  createThreadFromMessage,
  deleteChannel,
  deleteChannelMessage,
  findGuildChannelByName,
  findGuildVoiceChannelByName,
  postChannelMessage,
} from './discord.js';
import { buildRecruitingMessage, parseScheduleFields } from './schedule.js';
import {
  baiyeVoiceService,
  formatRemainingDuration,
} from './baiye-voice.js';
import {
  addMessageReactionRule,
  createLfg,
  getScheduleMessage,
  getMessageReactionRules,
  getProfile,
  joinLfg,
  listOpenLfg,
  removeMessageReactionRule,
  removeScheduleMessage,
  saveBuild,
  saveMessageReactionRule,
  saveProfile,
  saveScheduleMessage,
  searchBuilds,
  voteBuild,
} from './storage.js';
import { resolveGuildEmojiName } from './gateway-reactions.js';
import {
  buildSupportLogMessage,
  buildSupportTicket,
  extractModalValues,
  getInteractionUser,
  getOption,
} from './support.js';
import {
  buildSavedMessage,
  buildSearchMessage,
  buildVoteButtons,
  buildVotedMessage,
  commandErrorMessage,
  ephemeral,
  eventDraftMessage,
  guideButtons,
  guideMessage,
  lfgButtons,
  lfgCreatedMessage,
  lfgJoinedMessage,
  lfgListMessage,
  autoReactionAccessDeniedMessage,
  autoReactionRuleClearedMessage,
  autoReactionRuleNotFoundMessage,
  autoReactionRuleSavedMessage,
  autoReactionRulesMessage,
  memeCandidateEmbed,
  memePostButtons,
  memeSearchEmbeds,
  memeSearchMessage,
  newsMessage,
  presenceInfoMessage,
  profileSavedMessage,
  profileViewMessage,
  publicMessage,
  resourcesMessage,
  steamAchievementsMessage,
  steamStatusMessage,
  supportDetailsModal,
  supportNeedsDetailsMessage,
  supportSubmittedMessage,
  translateMessage,
  updateMessage,
  useCasesMessage,
  wikiSearchMessage,
} from './views.js';

function getSubcommand(options = []) {
  return options.find((option) => option.type === 1 || Array.isArray(option.options));
}

function getUserId(interaction) {
  return getInteractionUser(interaction).id;
}

function splitChannelIds(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function canEditAutoReaction(interaction) {
  const roleId = process.env.MESSAGE_REACTION_ADMIN_ROLE_ID;
  return Boolean(roleId && interaction.member?.roles?.includes(roleId));
}

function readAutoReactionRuleIdentity(options) {
  const userId = String(getOption(options, 'user_id', '')).trim();
  if (!/^\d{17,22}$/.test(userId)) {
    throw new Error('目标用户 ID 格式不正确。');
  }

  const emojiName = String(getOption(options, 'emoji_name', getOption(options, 'emoji', ''))).trim();
  if (!emojiName) {
    throw new Error('请提供服务器自定义表情名称。');
  }

  return {
    userId,
    emojiName,
    channelIds: splitChannelIds(getOption(options, 'channel_ids', '')),
  };
}

async function readAutoReactionRuleOptions(interaction, options) {
  const identity = readAutoReactionRuleIdentity(options);
  const emoji = await resolveGuildEmojiName(
    identity.emojiName,
    interaction.guild_id,
  );

  return {
    ...identity,
    ...emoji,
  };
}

async function submitSupportTicket(interaction, fields) {
  const ticket = buildSupportTicket(interaction, fields);
  const supportChannelId = process.env.SUPPORT_CHANNEL_ID;
  const canPostSupportTicket = Boolean(supportChannelId && process.env.DISCORD_TOKEN);

  if (canPostSupportTicket) {
    postChannelMessage(supportChannelId, buildSupportLogMessage(ticket)).catch((error) => {
      console.error('Failed to post support ticket', error);
    });
  }

  return ephemeral(supportSubmittedMessage(ticket, canPostSupportTicket));
}

async function handleSupportCommand(interaction, options) {
  const category = getOption(options, 'category', 'other');
  const urgency = getOption(options, 'urgency', 'normal');
  const details = getOption(options, 'details', '');

  if (!details.trim()) {
    return supportNeedsDetailsMessage(category, urgency);
  }

  return submitSupportTicket(interaction, { category, urgency, details });
}

async function handleScheduleCommand(interaction, options) {
  const schedule = parseScheduleFields({
    time: getOption(options, 'time'),
    zone: getOption(options, 'zone'),
    activity: getOption(options, 'activity'),
  });
  const channelName = process.env.GROUP_RECRUITING_CHANNEL_NAME || 'group-recruiting';
  let channelId = process.env.GROUP_RECRUITING_CHANNEL_ID;
  if (!channelId) {
    const channel = await findGuildChannelByName(interaction.guild_id, channelName);
    channelId = channel?.id;
  }
  if (!channelId) {
    throw new Error(`找不到 #${channelName}，请检查频道名称或配置 GROUP_RECRUITING_CHANNEL_ID。`);
  }
  const userId = getUserId(interaction);
  const result = await postChannelMessage(channelId, buildRecruitingMessage(schedule, userId));
  const messageId = result.message?.id;
  if (!messageId) {
    throw new Error('Discord 没有返回招募消息 ID，无法启用取消功能。');
  }

  let threadId;
  try {
    await addMessageReaction(channelId, messageId, '👍');
    const thread = await createThreadFromMessage(
      channelId,
      messageId,
      `活动讨论｜${schedule.activity}`,
    );
    threadId = thread.id;
    if (!threadId) throw new Error('Discord 没有返回活动 thread ID。');
    await saveScheduleMessage(interaction.guild_id, {
      messageId,
      channelId,
      threadId,
      ownerId: userId,
      activity: schedule.activity,
      formattedTime: schedule.formattedTime,
      eventAt: schedule.eventAt,
    });
  } catch (error) {
    if (threadId) await deleteChannel(threadId).catch(() => {});
    await deleteChannelMessage(channelId, messageId).catch(() => {});
    throw error;
  }

  return ephemeral(
    `已发布到 <#${channelId}> 并创建 <#${threadId}>：${schedule.activity} · ${schedule.formattedTime}\n`
    + 'Bot 会在活动开始前 15 分钟在 thread 中提醒参与者。\n'
    + `Message ID：${messageId}\n取消时使用：\`/cancel message_id:${messageId}\``,
  );
}

function canManageGuild(interaction) {
  try {
    const permissions = BigInt(interaction.member?.permissions || 0);
    return Boolean(permissions & 0x8n) || Boolean(permissions & 0x20n);
  } catch {
    return false;
  }
}

function baiyeStatusMessage(session) {
  if (!session) return '目前没有已设置或进行中的百业战语音提醒。';
  if (session.phase === 'waiting') {
    return [
      `百业战将在 ${formatRemainingDuration(session.remainingToStartMs)}后开始。`,
      `一队频道：<#${session.channelOneId}>（刷新前 35 秒）`,
      `二队频道：<#${session.channelTwoId}>（一队播完后立即接续）`,
      'Bot 会在第 5、10、15、20、25 分钟刷新前先后进入两个频道，每个频道播完即退出。',
    ].join('\n');
  }
  if (session.phase === 'error') {
    return `百业战语音提醒启动失败：${session.errorMessage || '未知错误'}`;
  }
  return [
    `百业战进行中，距离结束还有 ${formatRemainingDuration(session.remainingToEndMs)}。`,
    `一队频道：<#${session.channelOneId}>（刷新前 35 秒）`,
    `二队频道：<#${session.channelTwoId}>（一队播完后立即接续）`,
    '仅播报之后的提醒，已错过的提醒不会补播；大龙提醒在剩余 17:05 和 16:05 时触发。',
  ].join('\n');
}

const DEFAULT_GUILDWAR_CHANNEL_ONE_NAME = '百业战进攻队';
const DEFAULT_GUILDWAR_CHANNEL_TWO_NAME = '百业战防守队';

async function handleBaiyeCommand(interaction, options, service, findVoiceChannel) {
  const subcommand = getSubcommand(options);
  const subOptions = subcommand?.options ?? [];
  const guildId = interaction.guild_id;
  const userId = getUserId(interaction);

  if (!guildId) throw new Error('百业战语音提醒只能在 Discord 服务器中使用。');

  if (subcommand?.name === 'setup') {
    let channelOneId = String(
      getOption(subOptions, 'channel_one', '') || process.env.GUILDWAR_CHANNEL_ONE_ID || '',
    ).trim();
    let channelTwoId = String(
      getOption(subOptions, 'channel_two', '') || process.env.GUILDWAR_CHANNEL_TWO_ID || '',
    ).trim();
    const [defaultChannelOne, defaultChannelTwo] = await Promise.all([
      channelOneId ? undefined : findVoiceChannel(guildId, DEFAULT_GUILDWAR_CHANNEL_ONE_NAME),
      channelTwoId ? undefined : findVoiceChannel(guildId, DEFAULT_GUILDWAR_CHANNEL_TWO_NAME),
    ]);
    channelOneId ||= defaultChannelOne?.id || '';
    channelTwoId ||= defaultChannelTwo?.id || '';
    if (!channelOneId) throw new Error(`找不到默认语音频道“${DEFAULT_GUILDWAR_CHANNEL_ONE_NAME}”。`);
    if (!channelTwoId) throw new Error(`找不到默认语音频道“${DEFAULT_GUILDWAR_CHANNEL_TWO_NAME}”。`);
    const startIn = getOption(subOptions, 'start_in_minutes');
    const session = await service.setup({
      guildId,
      channelOneId,
      channelTwoId,
      ownerId: userId,
      startIn,
      remainingTime: getOption(subOptions, 'remaining_time'),
    });
    if (session.phase === 'error') throw new Error(session.errorMessage);
    return ephemeral(`百业战语音提醒已设置。\n${baiyeStatusMessage(session)}`);
  }

  if (subcommand?.name === 'status') {
    return ephemeral(baiyeStatusMessage(service.getSession(guildId)));
  }

  if (subcommand?.name === 'stop') {
    const session = service.getSession(guildId);
    if (!session) return ephemeral('目前没有需要停止的百业战语音提醒。');
    if (session.ownerId !== userId && !canManageGuild(interaction)) {
      throw new Error('只有设置提醒的人或服务器管理员可以停止百业战提醒。');
    }
    service.stop(guildId);
    return ephemeral('已停止百业战语音提醒，Bot 将离开语音频道。');
  }

  throw new Error('未知百业战操作。');
}

async function handleCancelCommand(interaction, options) {
  const messageId = String(getOption(options, 'message_id', '')).trim();
  if (!/^\d{17,22}$/.test(messageId)) {
    throw new Error('Message ID 格式不正确。请右键招募消息并选择 Copy Message ID。');
  }

  const schedule = await getScheduleMessage(interaction.guild_id, messageId);
  if (!schedule) {
    throw new Error('找不到由 /schedule 发布的这条招募消息。');
  }
  if (schedule.ownerId !== getUserId(interaction)) {
    throw new Error('只有原发起人可以取消这条招募。');
  }

  try {
    await deleteChannelMessage(schedule.channelId, messageId);
  } catch (error) {
    if (!String(error?.message || error).includes('Discord API 404')) throw error;
  }
  if (schedule.threadId) {
    await deleteChannel(schedule.threadId).catch((error) => {
      if (!String(error?.message || error).includes('Discord API 404')) {
        console.error(`Failed to delete schedule thread ${schedule.threadId}`, error);
      }
    });
  }
  await removeScheduleMessage(interaction.guild_id, messageId);
  return ephemeral(`已取消并撤回招募：${schedule.activity}`);
}

async function handleProfileCommand(interaction, options) {
  const subcommand = getSubcommand(options);
  const subOptions = subcommand?.options ?? [];
  const userId = getUserId(interaction);

  if (subcommand?.name === 'set') {
    const profile = await saveProfile(interaction.guild_id, userId, {
      characterName: getOption(subOptions, 'character'),
      role: getOption(subOptions, 'role', 'casual'),
      weapons: getOption(subOptions, 'weapons', ''),
      innerWays: getOption(subOptions, 'inner_ways', ''),
      sect: getOption(subOptions, 'sect', ''),
      server: getOption(subOptions, 'server', ''),
      timezone: getOption(subOptions, 'timezone', ''),
    });
    return ephemeral(profileSavedMessage(profile));
  }

  const profile = await getProfile(interaction.guild_id, userId);
  return ephemeral(profileViewMessage(userId, profile));
}

async function handleLfgCommand(interaction, options) {
  const subcommand = getSubcommand(options);
  const subOptions = subcommand?.options ?? [];
  const userId = getUserId(interaction);

  if (subcommand?.name === 'create') {
    const entry = await createLfg(interaction.guild_id, userId, {
      activity: getOption(subOptions, 'activity', 'other'),
      startsAt: getOption(subOptions, 'time'),
      note: getOption(subOptions, 'note', ''),
    });
    return publicMessage(lfgCreatedMessage(entry), lfgButtons(entry));
  }

  const entries = await listOpenLfg(interaction.guild_id);
  return ephemeral(lfgListMessage(entries));
}

async function handleBuildCommand(interaction, options) {
  const subcommand = getSubcommand(options);
  const subOptions = subcommand?.options ?? [];
  const userId = getUserId(interaction);

  if (subcommand?.name === 'share') {
    const build = await saveBuild(interaction.guild_id, userId, {
      name: getOption(subOptions, 'name'),
      weapon: getOption(subOptions, 'weapon'),
      role: getOption(subOptions, 'role'),
      innerWays: getOption(subOptions, 'inner_ways', ''),
      notes: getOption(subOptions, 'notes', ''),
    });
    return publicMessage(buildSavedMessage(build));
  }

  const query = getOption(subOptions, 'query', '');
  const builds = await searchBuilds(interaction.guild_id, query);
  return ephemeral(buildSearchMessage(query, builds), buildVoteButtons(builds));
}

async function handleAutoReactionCommand(interaction, options) {
  const subcommand = getSubcommand(options);
  const subOptions = subcommand?.options ?? [];
  const adminRoleId = process.env.MESSAGE_REACTION_ADMIN_ROLE_ID;

  if (subcommand?.name === 'view') {
    return ephemeral(autoReactionRulesMessage(await getMessageReactionRules(interaction.guild_id)));
  }

  if (!canEditAutoReaction(interaction)) {
    return ephemeral(autoReactionAccessDeniedMessage(adminRoleId));
  }

  if (subcommand?.name === 'clear') {
    const removed = await removeMessageReactionRule(
      interaction.guild_id,
      readAutoReactionRuleIdentity(subOptions),
    );
    return ephemeral(removed
      ? autoReactionRuleClearedMessage(removed)
      : autoReactionRuleNotFoundMessage());
  }

  if (subcommand?.name === 'set' || subcommand?.name === 'add') {
    const payload = {
      ...await readAutoReactionRuleOptions(interaction, subOptions),
      updatedBy: getUserId(interaction),
    };
    const rule = subcommand.name === 'add'
      ? await addMessageReactionRule(interaction.guild_id, payload)
      : await saveMessageReactionRule(interaction.guild_id, payload);

    return ephemeral(autoReactionRuleSavedMessage(rule));
  }

  return ephemeral('未知自动反应操作。');
}

async function handleCommand(
  interaction,
  {
    baiyeService = baiyeVoiceService,
    findVoiceChannel = findGuildVoiceChannelByName,
  } = {},
) {
  const { name, options = [] } = interaction.data;

  if (name === 'support') {
    return handleSupportCommand(interaction, options);
  }

  if (name === 'schedule') {
    return handleScheduleCommand(interaction, options);
  }

  if (name === 'cancel') {
    return handleCancelCommand(interaction, options);
  }

  if (name === 'guildwar') {
    return handleBaiyeCommand(interaction, options, baiyeService, findVoiceChannel);
  }

  if (name === 'wwm-guide') {
    const topic = getOption(options, 'topic', 'daily');
    return publicMessage(guideMessage(topic), guideButtons(topic));
  }

  if (name === 'event-plan') {
    return publicMessage(
      eventDraftMessage({
        activity: getOption(options, 'activity'),
        startsAt: getOption(options, 'time'),
        note: getOption(options, 'note'),
      }),
    );
  }

  if (name === 'news') {
    return ephemeral(newsMessage(await fetchOfficialNews()));
  }

  if (name === 'steam') {
    const topic = getOption(options, 'topic', 'status');
    if (topic === 'achievements') {
      return ephemeral(steamAchievementsMessage(await fetchSteamAchievementPercentages()));
    }
    return ephemeral(steamStatusMessage(await fetchSteamCurrentPlayers()));
  }

  if (name === 'wiki') {
    const query = getOption(options, 'query');
    return ephemeral(wikiSearchMessage(query, await searchWiki(query)));
  }

  if (name === 'meme') {
    const query = getOption(options, 'query');
    const isPublic = Boolean(getOption(options, 'public', false));
    const result = await searchMemeStickers(query);
    const response = memeSearchMessage(query, result);
    const embeds = memeSearchEmbeds(result);
    if (isPublic) {
      return publicMessage(response, [], embeds);
    }
    const selections = rememberMemeCandidates(result.results, getUserId(interaction), query);
    return ephemeral(response, memePostButtons(selections), embeds);
  }

  if (name === 'translate') {
    const text = getOption(options, 'text');
    const target = getOption(options, 'target');
    const isPublic = Boolean(getOption(options, 'public', false));
    const result = await translateText({ text, target });
    const response = translateMessage({ text, result });
    return isPublic ? publicMessage(response) : ephemeral(response);
  }

  if (name === 'profile') {
    return handleProfileCommand(interaction, options);
  }

  if (name === 'lfg') {
    return handleLfgCommand(interaction, options);
  }

  if (name === 'build') {
    return handleBuildCommand(interaction, options);
  }

  if (name === 'auto-reaction') {
    return handleAutoReactionCommand(interaction, options);
  }

  if (name === 'resources') {
    return ephemeral(resourcesMessage());
  }

  if (name === 'presence-info') {
    return ephemeral(presenceInfoMessage());
  }

  if (name === 'use-cases') {
    return ephemeral(useCasesMessage());
  }

  return ephemeral(`未知命令：${name}`);
}

async function handleComponent(interaction) {
  const customId = interaction.data.custom_id;
  const userId = getUserId(interaction);

  if (customId.startsWith('guide:')) {
    const topic = customId.split(':')[1];
    return updateMessage(guideMessage(topic), guideButtons(topic));
  }

  if (customId.startsWith('support_details:')) {
    const [, category = 'other', urgency = 'normal'] = customId.split(':');
    return supportDetailsModal(category, urgency);
  }

  if (customId.startsWith('lfg_join:')) {
    const [, lfgId] = customId.split(':');
    const entry = await joinLfg(interaction.guild_id, lfgId, userId);
    if (!entry) {
      return ephemeral('这个组队已经不存在或无法加入。');
    }
    return updateMessage(lfgJoinedMessage(entry, userId), lfgButtons(entry));
  }

  if (customId.startsWith('build_vote:')) {
    const [, buildId] = customId.split(':');
    const build = await voteBuild(interaction.guild_id, buildId, userId);
    if (!build) {
      return ephemeral('这条配装记录已经不存在。');
    }
    return ephemeral(buildVotedMessage(build));
  }

  if (customId.startsWith('meme_post:')) {
    const [, selectionId] = customId.split(':');
    const entry = consumeMemeCandidate(selectionId, userId);
    if (!entry) {
      return ephemeral('这个表情包候选已经过期或已经发送过。请重新使用 `/meme` 搜索。');
    }

    if (entry.ownerMismatch) {
      return ephemeral('只有发起搜索的人可以发送这个表情包候选。');
    }

    if (!interaction.channel_id) {
      return ephemeral('无法识别当前频道，请重新使用 `/meme` 搜索。');
    }

    await postChannelMessage(interaction.channel_id, {
      content: '',
      embeds: [memeCandidateEmbed(entry.candidate)],
    });

    return updateMessage('', [], interaction.message?.embeds ?? []);
  }

  return ephemeral(`未知组件：${customId}`);
}

async function handleModalSubmit(interaction) {
  const customId = interaction.data.custom_id;

  if (customId.startsWith('support_submit:')) {
    const [, category = 'other', urgency = 'normal'] = customId.split(':');
    const values = extractModalValues(interaction.data.components);
    return submitSupportTicket(interaction, {
      category,
      urgency,
      details: values.details,
    });
  }

  return ephemeral(`未知表单：${customId}`);
}

export async function handleInteraction(interaction, dependencies = {}) {
  try {
    if (interaction.type === InteractionType.PING) {
      return { type: InteractionResponseType.PONG };
    }

    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      return await handleCommand(interaction, dependencies);
    }

    if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
      return await handleComponent(interaction);
    }

    if (interaction.type === InteractionType.MODAL_SUBMIT) {
      return await handleModalSubmit(interaction);
    }

    return ephemeral(`暂不支持的交互类型：${interaction.type}`);
  } catch (error) {
    console.error('Interaction failed', error);
    return ephemeral(commandErrorMessage(error));
  }
}
