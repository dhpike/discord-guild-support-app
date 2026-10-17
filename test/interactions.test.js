import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { InteractionResponseType } from '../src/constants.js';
import { handleInteraction } from '../src/interactions.js';
import { rememberMemeCandidates } from '../src/integrations/meme-stickers.js';

const originalDiscordToken = process.env.DISCORD_TOKEN;
const originalReactionAdminRoleId = process.env.MESSAGE_REACTION_ADMIN_ROLE_ID;
const originalRecruitingChannelId = process.env.GROUP_RECRUITING_CHANNEL_ID;
const originalRecruitingChannelName = process.env.GROUP_RECRUITING_CHANNEL_NAME;
const originalDataDir = process.env.DATA_DIR;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalDiscordToken === undefined) {
    delete process.env.DISCORD_TOKEN;
  } else {
    process.env.DISCORD_TOKEN = originalDiscordToken;
  }

  if (originalReactionAdminRoleId === undefined) {
    delete process.env.MESSAGE_REACTION_ADMIN_ROLE_ID;
  } else {
    process.env.MESSAGE_REACTION_ADMIN_ROLE_ID = originalReactionAdminRoleId;
  }

  for (const [name, value] of [
    ['GROUP_RECRUITING_CHANNEL_ID', originalRecruitingChannelId],
    ['GROUP_RECRUITING_CHANNEL_NAME', originalRecruitingChannelName],
    ['DATA_DIR', originalDataDir],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  globalThis.fetch = originalFetch;
});

describe('interaction routing', () => {
  it('posts parsed schedules and lets only the publisher cancel them', async () => {
    process.env.DISCORD_TOKEN = 'test-token';
    process.env.GROUP_RECRUITING_CHANNEL_ID = 'recruiting-channel';
    process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'wwm-interactions-'));
    const calls = [];
    globalThis.fetch = async (url, requestOptions) => {
      calls.push({
        url,
        method: requestOptions.method,
        body: requestOptions.body ? JSON.parse(requestOptions.body) : undefined,
      });
      if (url.endsWith('/channels/recruiting-channel/messages')) {
        return { ok: true, json: async () => ({ id: '1534651572061999304' }) };
      }
      if (url.endsWith('/channels/recruiting-channel/messages/1534651572061999304/threads')) {
        return { ok: true, json: async () => ({ id: '1534651572061999305' }) };
      }
      return { ok: true };
    };
    const response = await handleInteraction({
      type: 2,
      guild_id: 'guild-1',
      channel_id: 'source-channel',
      member: { user: { id: 'user-1', username: 'tester' } },
      data: {
        name: 'schedule',
        options: [
          { name: 'time', value: '明晚十点' },
          { name: 'zone', value: '美东' },
          { name: 'activity', value: '五人竞速' },
        ],
      },
    });
    assert.equal(response.type, InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    assert.match(response.data.content, /已发布到 <#recruiting-channel>/);
    assert.match(response.data.content, /1534651572061999304/);
    assert.equal(calls.length, 3);
    assert.match(calls[0].url, /\/channels\/recruiting-channel\/messages$/);
    assert.match(calls[0].body.content, /^招募：五人竞速\n时间：\d{1,2}\/\d{1,2}\/\d{4} 周/);
    assert.match(
      calls[0].body.content,
      /晚上 10:00（美东）\n发起人：<@user-1>\n\n👇 有意参加？请点击下方 👍 或任意表情报名！$/,
    );
    assert.match(
      calls[1].url,
      /\/channels\/recruiting-channel\/messages\/1534651572061999304\/reactions\/%F0%9F%91%8D\/@me$/,
    );
    assert.equal(calls[1].method, 'PUT');
    assert.match(
      calls[2].url,
      /\/channels\/recruiting-channel\/messages\/1534651572061999304\/threads$/,
    );
    assert.equal(calls[2].body.name, '活动讨论｜五人竞速');

    const denied = await handleInteraction({
      type: 2,
      guild_id: 'guild-1',
      member: { user: { id: 'user-2', username: 'other' } },
      data: {
        name: 'cancel',
        options: [{ name: 'message_id', value: '1534651572061999304' }],
      },
    });
    assert.match(denied.data.content, /只有原发起人可以取消/);
    assert.equal(calls.length, 3);

    const cancelled = await handleInteraction({
      type: 2,
      guild_id: 'guild-1',
      member: { user: { id: 'user-1', username: 'tester' } },
      data: {
        name: 'cancel',
        options: [{ name: 'message_id', value: '1534651572061999304' }],
      },
    });
    assert.match(cancelled.data.content, /已取消并撤回招募/);
    assert.equal(calls.length, 5);
    assert.equal(calls[3].method, 'DELETE');
    assert.match(calls[3].url, /\/channels\/recruiting-channel\/messages\/1534651572061999304$/);
    assert.equal(calls[4].method, 'DELETE');
    assert.match(calls[4].url, /\/channels\/1534651572061999305$/);
  });

  it('posts selected meme as a standalone channel message without referencing the candidate message', async () => {
    process.env.DISCORD_TOKEN = 'test-token';
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return { ok: true };
    };

    const [selection] = rememberMemeCandidates([{
      title: '猫猫无语',
      description: '斗图啦表情包候选',
      pageUrl: 'https://www.doutupk.com/photo/1',
      imageUrl: 'https://img.doutupk.com/cat.gif',
      source: 'doutupk',
      sourceLabel: '斗图啦',
    }], 'user-1', '猫猫无语');

    const originalEmbeds = [
      { image: { url: 'https://img.doutupk.com/candidate-1.gif' } },
      { image: { url: 'https://img.doutupk.com/candidate-2.gif' } },
    ];

    const response = await handleInteraction({
      type: 3,
      guild_id: 'guild-1',
      channel_id: 'channel-1',
      member: { user: { id: 'user-1', username: 'tester' } },
      data: { custom_id: `meme_post:${selection.id}` },
      message: {
        content: '',
        embeds: originalEmbeds,
        components: [{ type: 1, components: [] }],
      },
    });

    assert.equal(response.type, InteractionResponseType.UPDATE_MESSAGE);
    assert.deepEqual(response.data, {
      content: '',
      components: [],
      embeds: originalEmbeds,
      allowed_mentions: { parse: [] },
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/channels\/channel-1\/messages$/);
    assert.deepEqual(calls[0].body, {
      allowed_mentions: { parse: [] },
      content: '',
      embeds: [{ image: { url: 'https://img.doutupk.com/cat.gif' } }],
    });
    assert.equal(Object.hasOwn(calls[0].body, 'message_reference'), false);
  });

  it('blocks auto-reaction edits from members without the configured role', async () => {
    process.env.MESSAGE_REACTION_ADMIN_ROLE_ID = 'role-1';

    const response = await handleInteraction({
      type: 2,
      guild_id: 'guild-1',
      member: {
        roles: ['other-role'],
        user: { id: 'user-1', username: 'tester' },
      },
      data: {
        name: 'auto-reaction',
        options: [{
          name: 'set',
          options: [
            { name: 'user_id', value: '1017955151765573723' },
            { name: 'emoji', value: 'lubian' },
          ],
        }],
      },
    });

    assert.equal(response.type, InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    assert.match(response.data.content, /只有 <@&role-1> 可以修改自动反应设置/);
  });

  it('keeps guildwar setup, status, and control responses private', async () => {
    const calls = [];
    let session;
    const baiyeService = {
      async setup(input) {
        calls.push(['setup', input]);
        session = {
          ...input,
          phase: 'waiting',
          remainingToStartMs: 10 * 60 * 1000,
          remainingToEndMs: 40 * 60 * 1000,
        };
        return session;
      },
      getSession() {
        return session;
      },
      stop(guildId) {
        calls.push(['stop', guildId]);
        const previous = session;
        session = null;
        return previous;
      },
    };
    const setupInteraction = {
      type: 2,
      guild_id: 'guild-1',
      member: { user: { id: 'user-1', username: 'tester' } },
      data: {
        name: 'guildwar',
        options: [{
          name: 'setup',
          options: [
            { name: 'start_in_minutes', value: '10' },
            { name: 'channel_one', value: 'voice-1' },
            { name: 'channel_two', value: 'voice-2' },
          ],
        }],
      },
    };

    const setupResponse = await handleInteraction(setupInteraction, { baiyeService });
    assert.equal(setupResponse.data.flags, 64);
    assert.match(setupResponse.data.content, /已设置/);
    assert.match(setupResponse.data.content, /10 分钟后开始/);
    assert.match(setupResponse.data.content, /<#voice-1>/);
    assert.match(setupResponse.data.content, /<#voice-2>/);
    assert.deepEqual(calls[0], ['setup', {
      guildId: 'guild-1',
      channelOneId: 'voice-1',
      channelTwoId: 'voice-2',
      ownerId: 'user-1',
      startIn: '10',
      remainingTime: undefined,
    }]);

    const status = await handleInteraction({
      ...setupInteraction,
      data: { name: 'guildwar', options: [{ type: 1, name: 'status' }] },
    }, { baiyeService });
    assert.equal(status.data.flags, 64);
    assert.match(status.data.content, /10 分钟后开始/);
    assert.match(status.data.content, /第 5、10、15、20、25 分钟/);
    assert.match(status.data.content, /播完即退出/);

    const denied = await handleInteraction({
      ...setupInteraction,
      member: { user: { id: 'user-2', username: 'other' } },
      data: { name: 'guildwar', options: [{ type: 1, name: 'stop' }] },
    }, { baiyeService });
    assert.equal(denied.data.flags, 64);
    assert.match(denied.data.content, /只有设置提醒的人或服务器管理员/);
    assert.equal(calls.length, 1);

    const stopped = await handleInteraction({
      ...setupInteraction,
      member: { permissions: '32', user: { id: 'admin-1', username: 'admin' } },
      data: { name: 'guildwar', options: [{ type: 1, name: 'stop' }] },
    }, { baiyeService });
    assert.equal(stopped.data.flags, 64);
    assert.match(stopped.data.content, /已停止/);
    assert.deepEqual(calls[1], ['stop', 'guild-1']);
  });

  it('passes an in-progress countdown through setup and replies privately', async () => {
    let input;
    const response = await handleInteraction({
      type: 2,
      guild_id: 'guild-late',
      member: { user: { id: 'user-1' } },
      data: {
        name: 'guildwar',
        options: [{ type: 1, name: 'setup', options: [
          { name: 'remaining_time', value: '24:30' },
          { name: 'channel_one', value: 'attack' },
          { name: 'channel_two', value: 'defense' },
        ] }],
      },
    }, { baiyeService: {
      async setup(value) {
        input = value;
        return { ...value, phase: 'running', remainingToStartMs: 0, remainingToEndMs: 1_470_000 };
      },
    } });
    assert.equal(input.startIn, undefined);
    assert.equal(input.remainingTime, '24:30');
    assert.equal(input.channelOneId, 'attack');
    assert.equal(input.channelTwoId, 'defense');
    assert.equal(response.data.flags, 64);
    assert.match(response.data.content, /24 分 30 秒/);
    assert.match(response.data.content, /不会补播/);
  });

  it('resolves the two default guildwar voice channels when overrides are omitted', async () => {
    const resolvedNames = [];
    let setupInput;
    const baiyeService = {
      async setup(input) {
        setupInput = input;
        return {
          ...input,
          phase: 'waiting',
          remainingToStartMs: 89_000,
          remainingToEndMs: (30 * 60 * 1000) + 89_000,
        };
      },
    };
    const findVoiceChannel = async (_guildId, name) => {
      resolvedNames.push(name);
      return { id: name.includes('进攻') ? 'attack-voice' : 'defense-voice' };
    };

    const response = await handleInteraction({
      type: 2,
      guild_id: 'guild-defaults',
      member: { user: { id: 'user-1', username: 'tester' } },
      data: {
        name: 'guildwar',
        options: [{
          type: 1,
          name: 'setup',
          options: [{ name: 'start_in_minutes', value: '1:29' }],
        }],
      },
    }, { baiyeService, findVoiceChannel });

    assert.equal(response.data.flags, 64);
    assert.match(response.data.content, /1 分 29 秒后开始/);
    assert.deepEqual(resolvedNames, ['百业战进攻队', '百业战防守队']);
    assert.deepEqual(setupInput, {
      guildId: 'guild-defaults',
      channelOneId: 'attack-voice',
      channelTwoId: 'defense-voice',
      ownerId: 'user-1',
      startIn: '1:29',
      remainingTime: undefined,
    });
  });
});
