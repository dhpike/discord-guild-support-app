import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_COMMANDS, GUILDWAR_COMMAND, SCHEDULE_COMMAND } from '../src/commands.js';

describe('Discord command definitions', () => {
  it('places all required options before optional options', () => {
    for (const command of ALL_COMMANDS) {
      let sawOptional = false;
      for (const option of command.options ?? []) {
        if (!option.required) sawOptional = true;
        assert.equal(
          Boolean(sawOptional && option.required),
          false,
          `${command.name}.${option.name} is required after an optional option`,
        );
      }
    }
  });

  it('keeps the required schedule zone between time and activity', () => {
    assert.deepEqual(SCHEDULE_COMMAND.options.map(({ name, required }) => ({ name, required })), [
      { name: 'time', required: true },
      { name: 'zone', required: true },
      { name: 'activity', required: true },
    ]);
  });

  it('offers start delay or remaining countdown with optional guildwar channels', () => {
    const setup = GUILDWAR_COMMAND.options.find((option) => option.name === 'setup');
    assert.equal(GUILDWAR_COMMAND.name, 'guildwar');
    assert.deepEqual(setup.options.map(({ name, required }) => ({ name, required })), [
      { name: 'start_in_minutes', required: false },
      { name: 'remaining_time', required: false },
      { name: 'channel_one', required: false },
      { name: 'channel_two', required: false },
    ]);
    assert.equal(setup.options[0].type, 3);
    assert.equal(setup.options[1].type, 3);
    assert.deepEqual(setup.options[2].channel_types, [2]);
    assert.deepEqual(setup.options[3].channel_types, [2]);
  });
});
