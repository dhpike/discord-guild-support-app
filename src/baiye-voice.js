import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

export const BAIYE_DURATION_MS = 30 * 60 * 1000;
export const BAIYE_REFRESH_OFFSETS_MS = [5, 10, 15, 20, 25]
  .map((minutes) => minutes * 60 * 1000);
export const BAIYE_DRAGON_COUNTDOWNS_MS = [
  (17 * 60) + 5,
  (16 * 60) + 5,
].map((seconds) => seconds * 1000);
export const BAIYE_FIRST_WARNING_LEAD_MS = 35 * 1000;
export const BAIYE_WARNING_REPETITIONS = 2;
export const BAIYE_WARNING_GAP_MS = 100;
export const DEFAULT_BAIYE_WARNING_GAIN = 2.2;

const PCM_BYTES_PER_SECOND = 48_000 * 2 * 2;
const MAX_BAIYE_START_DELAY_MS = 180 * 60 * 1000;

const DEFAULT_WARNING_AUDIO_FILE = fileURLToPath(
  new URL('../assets/baiye-refresh-warning.wav', import.meta.url),
);
const DEFAULT_DRAGON_WARNING_AUDIO_FILE = fileURLToPath(
  new URL('../assets/baiye-dragon-warning.wav', import.meta.url),
);

function readFourCc(buffer, offset) {
  return buffer.toString('ascii', offset, offset + 4);
}

export function readPcmWave(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44) {
    throw new Error('百业战提醒音频不是有效的 WAV 文件。');
  }
  if (readFourCc(buffer, 0) !== 'RIFF' || readFourCc(buffer, 8) !== 'WAVE') {
    throw new Error('百业战提醒音频必须使用 WAV 格式。');
  }

  let offset = 12;
  let format;
  let pcm;
  while (offset + 8 <= buffer.length) {
    const chunkId = readFourCc(buffer, offset);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;
    if (chunkEnd > buffer.length) break;

    if (chunkId === 'fmt ' && chunkSize >= 16) {
      format = {
        audioFormat: buffer.readUInt16LE(chunkStart),
        channels: buffer.readUInt16LE(chunkStart + 2),
        sampleRate: buffer.readUInt32LE(chunkStart + 4),
        bitsPerSample: buffer.readUInt16LE(chunkStart + 14),
      };
    } else if (chunkId === 'data') {
      pcm = buffer.subarray(chunkStart, chunkEnd);
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  if (!format || !pcm) {
    throw new Error('百业战提醒 WAV 缺少音频数据。');
  }
  if (
    format.audioFormat !== 1
    || format.channels !== 2
    || format.sampleRate !== 48_000
    || format.bitsPerSample !== 16
  ) {
    throw new Error('百业战提醒 WAV 必须是 48kHz、16-bit、双声道 PCM。');
  }

  return pcm;
}

export function buildWarningPcm(
  pcm,
  {
    gain = DEFAULT_BAIYE_WARNING_GAIN,
    repetitions = BAIYE_WARNING_REPETITIONS,
    gapMs = BAIYE_WARNING_GAP_MS,
  } = {},
) {
  if (!Buffer.isBuffer(pcm) || pcm.length === 0 || pcm.length % 2 !== 0) {
    throw new Error('百业战提醒 PCM 数据无效。');
  }
  if (!Number.isFinite(gain) || gain < 1 || gain > 4) {
    throw new Error('BAIYE_WARNING_GAIN 必须是 1 到 4 之间的数字。');
  }
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 4) {
    throw new Error('百业战提醒播放次数无效。');
  }

  const amplified = Buffer.allocUnsafe(pcm.length);
  const limiter = Math.tanh(gain);
  for (let offset = 0; offset < pcm.length; offset += 2) {
    const normalized = pcm.readInt16LE(offset) / 32_768;
    const boosted = Math.tanh(normalized * gain) / limiter;
    const sample = Math.max(-32_768, Math.min(32_767, Math.round(boosted * 32_767)));
    amplified.writeInt16LE(sample, offset);
  }

  const gapBytes = Math.round((PCM_BYTES_PER_SECOND * gapMs) / 1000);
  const gap = Buffer.alloc(gapBytes - (gapBytes % 4));
  const parts = [];
  for (let index = 0; index < repetitions; index += 1) {
    if (index > 0 && gap.length) parts.push(gap);
    parts.push(amplified);
  }
  return Buffer.concat(parts);
}

function parseMinutesAndSeconds(value, label) {
  const input = String(value ?? '').trim();
  let milliseconds;

  if (/^\d+$/.test(input)) {
    milliseconds = Number(input) * 60 * 1000;
  } else {
    const match = input.match(/^(\d{1,3}):([0-5]\d)$/);
    if (!match) {
      throw new Error(`${label}请输入分钟（如 10）或分:秒（如 1:29）。`);
    }
    milliseconds = ((Number(match[1]) * 60) + Number(match[2])) * 1000;
  }

  return milliseconds;
}

export function parseStartDelay(value) {
  const milliseconds = parseMinutesAndSeconds(value, '距离开战时间');
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0 || milliseconds > MAX_BAIYE_START_DELAY_MS) {
    throw new Error('距离开战时间必须在 0 到 180 分钟之间。');
  }
  return milliseconds;
}

export function parseRemainingTime(value) {
  const milliseconds = parseMinutesAndSeconds(value, '战斗剩余时间');
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0 || milliseconds > BAIYE_DURATION_MS) {
    throw new Error('战斗剩余时间必须大于 0 且不超过 30:00。');
  }
  return milliseconds;
}

class DiscordVoiceConnector {
  constructor({
    token = process.env.DISCORD_TOKEN,
    audioFile,
    dragonAudioFile,
    warningGain = Number(process.env.BAIYE_WARNING_GAIN || DEFAULT_BAIYE_WARNING_GAIN),
  } = {}) {
    this.token = token;
    this.audioFile = audioFile || process.env.BAIYE_WARNING_AUDIO_FILE || DEFAULT_WARNING_AUDIO_FILE;
    this.dragonAudioFile = dragonAudioFile
      || process.env.BAIYE_DRAGON_WARNING_AUDIO_FILE
      || DEFAULT_DRAGON_WARNING_AUDIO_FILE;
    this.warningGain = warningGain;
    this.client = null;
    this.preparePromise = null;
    this.voiceModule = null;
    this.warningPcmPromises = new Map();
  }

  async prepare() {
    if (!this.token) throw new Error('DISCORD_TOKEN 未配置，无法连接语音频道。');
    if (this.client?.isReady()) return this.client;
    if (this.preparePromise) return this.preparePromise;

    this.preparePromise = (async () => {
      const { Client, Events, GatewayIntentBits } = await import('discord.js');
      const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
      });
      const ready = new Promise((resolve, reject) => {
        client.once(Events.ClientReady, resolve);
        client.once(Events.Error, reject);
      });
      await client.login(this.token);
      if (!client.isReady()) await ready;
      this.client = client;
      return client;
    })().catch((error) => {
      this.preparePromise = null;
      throw error;
    });

    return this.preparePromise;
  }

  async loadWarningPcm(kind = 'mob') {
    if (!['mob', 'dragon'].includes(kind)) throw new Error(`未知的百业战播报类型：${kind}`);
    if (!this.warningPcmPromises.has(kind)) {
      const audioFile = kind === 'dragon' ? this.dragonAudioFile : this.audioFile;
      this.warningPcmPromises.set(
        kind,
        readFile(audioFile)
          .then(readPcmWave)
          .then((pcm) => buildWarningPcm(pcm, { gain: this.warningGain })),
      );
    }
    return this.warningPcmPromises.get(kind);
  }

  async connect({ guildId, channelId }) {
    const client = await this.prepare();
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId);
    if (!channel?.isVoiceBased?.() || channel.isStageVoice?.()) {
      throw new Error('请选择普通语音频道，暂不支持 Stage Channel。');
    }

    this.voiceModule ??= await import('@discordjs/voice');
    const {
      AudioPlayerStatus,
      NoSubscriberBehavior,
      StreamType,
      VoiceConnectionStatus,
      createAudioPlayer,
      createAudioResource,
      entersState,
      joinVoiceChannel,
    } = this.voiceModule;

    const connection = joinVoiceChannel({
      channelId,
      guildId,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    connection.subscribe(player);
    player.on('error', (error) => {
      console.error('Baiye voice player failed', error);
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (error) {
      connection.destroy();
      throw new Error(`无法加入语音频道，请检查 View Channel、Connect 和 Speak 权限：${error.message}`);
    }

    const connector = this;
    let destroyed = false;
    return {
      async playWarning(kind = 'mob') {
        const pcm = await connector.loadWarningPcm(kind);
        const resource = createAudioResource(Readable.from([pcm]), {
          inputType: StreamType.Raw,
        });
        player.play(resource);
        await entersState(player, AudioPlayerStatus.Playing, 5_000);
        await entersState(player, AudioPlayerStatus.Idle, 30_000);
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        player.stop(true);
        connection.destroy();
      },
    };
  }
}

export class BaiyeVoiceService {
  constructor({
    connector = new DiscordVoiceConnector(),
    now = () => Date.now(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = {}) {
    this.connector = connector;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.sessions = new Map();
  }

  async prepare() {
    return this.connector.prepare();
  }

  getSession(guildId) {
    const session = this.sessions.get(guildId);
    if (!session) return null;
    const now = this.now();
    return {
      guildId: session.guildId,
      channelOneId: session.channelOneId,
      channelTwoId: session.channelTwoId,
      ownerId: session.ownerId,
      phase: session.phase,
      startAt: new Date(session.startAt).toISOString(),
      endAt: new Date(session.endAt).toISOString(),
      remainingToStartMs: Math.max(0, session.startAt - now),
      remainingToEndMs: Math.max(0, session.endAt - now),
      errorMessage: session.errorMessage,
    };
  }

  schedule(session, at, callback) {
    const delay = Math.max(0, at - this.now());
    const timer = this.setTimer(() => {
      session.timers.delete(timer);
      void callback();
    }, delay);
    session.timers.add(timer);
    return timer;
  }

  clearSessionTimers(session) {
    for (const timer of session.timers) this.clearTimer(timer);
    session.timers.clear();
  }

  async announce(session, channelId, warningKind = 'mob') {
    if (this.sessions.get(session.guildId) !== session) return;
    let voice;

    try {
      voice = await this.connector.connect({
        guildId: session.guildId,
        channelId,
      });
      if (this.sessions.get(session.guildId) !== session) {
        voice.destroy();
        return;
      }
      session.voice = voice;
      await voice.playWarning(warningKind);
    } catch (error) {
      console.error(`Baiye ${warningKind} warning failed in channel ${channelId}`, error);
    } finally {
      if (session.voice === voice) session.voice = null;
      voice?.destroy();
    }
  }

  enqueueAnnouncement(session, channelId, warningKind = 'mob') {
    session.announcementQueue = session.announcementQueue
      .catch(() => {})
      .then(() => this.announce(session, channelId, warningKind));
  }

  enqueueBothChannels(session, warningKind) {
    this.enqueueAnnouncement(session, session.channelOneId, warningKind);
    this.enqueueAnnouncement(session, session.channelTwoId, warningKind);
  }

  begin(session) {
    if (this.sessions.get(session.guildId) !== session) return;
    session.phase = 'running';

    for (const refreshOffset of BAIYE_REFRESH_OFFSETS_MS) {
      const firstWarningAt = session.startAt + refreshOffset - BAIYE_FIRST_WARNING_LEAD_MS;
      if (firstWarningAt >= this.now()) {
        this.schedule(session, firstWarningAt, () => {
          this.enqueueBothChannels(session, 'mob');
        });
      }
    }

    for (const remainingCountdown of BAIYE_DRAGON_COUNTDOWNS_MS) {
      const warningAt = session.endAt - remainingCountdown;
      if (warningAt >= this.now()) {
        this.schedule(session, warningAt, () => {
          this.enqueueBothChannels(session, 'dragon');
        });
      }
    }

    if (session.endAt <= this.now()) {
      this.finish(session);
    } else {
      this.schedule(session, session.endAt, () => this.finish(session));
    }
  }

  async setup({ guildId, channelOneId, channelTwoId, ownerId, startIn, remainingTime }) {
    if (!guildId || !channelOneId || !channelTwoId || !ownerId) {
      throw new Error('百业战设置缺少服务器、两个语音频道或发起人。');
    }
    if (channelOneId === channelTwoId) throw new Error('请选择两个不同的语音频道。');
    if (this.sessions.has(guildId)) throw new Error('这个服务器已经有一个百业战提醒，请先使用 /guildwar stop。');

    const hasStartIn = startIn !== undefined && startIn !== null;
    const hasRemainingTime = remainingTime !== undefined && remainingTime !== null;
    if (hasStartIn === hasRemainingTime) {
      throw new Error('请二选一：开战前填写 start_in_minutes，开战后填写 remaining_time（游戏内剩余倒计时，如 24:30）。');
    }
    const setupAt = this.now();
    const startAt = hasRemainingTime
      ? setupAt + parseRemainingTime(remainingTime) - BAIYE_DURATION_MS
      : setupAt + parseStartDelay(startIn);

    await this.prepare();
    // Another setup may have completed while the voice gateway was connecting.
    if (this.sessions.has(guildId)) throw new Error('这个服务器已经有一个百业战提醒，请先使用 /guildwar stop。');
    if (startAt + BAIYE_DURATION_MS <= this.now()) {
      throw new Error('连接语音服务期间战斗已结束，请重新确认剩余时间。');
    }
    const running = startAt <= this.now();
    const session = {
      guildId,
      channelOneId,
      channelTwoId,
      ownerId,
      phase: running ? 'running' : 'waiting',
      startAt,
      endAt: startAt + BAIYE_DURATION_MS,
      timers: new Set(),
      voice: null,
      announcementQueue: Promise.resolve(),
      errorMessage: undefined,
    };
    this.sessions.set(guildId, session);

    if (running) this.begin(session);
    else this.schedule(session, startAt, () => this.begin(session));
    return this.getSession(guildId);
  }

  finish(session) {
    if (this.sessions.get(session.guildId) !== session) return;
    this.clearSessionTimers(session);
    session.voice?.destroy();
    this.sessions.delete(session.guildId);
  }

  stop(guildId) {
    const session = this.sessions.get(guildId);
    if (!session) return null;
    const snapshot = this.getSession(guildId);
    this.finish(session);
    return snapshot;
  }
}

export function formatRemainingDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes && seconds) return `${minutes} 分 ${seconds} 秒`;
  if (minutes) return `${minutes} 分钟`;
  return `${seconds} 秒`;
}

export const baiyeVoiceService = new BaiyeVoiceService();
