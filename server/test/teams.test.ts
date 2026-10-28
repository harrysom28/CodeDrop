import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTeamName, sameFixture, teamsMatch } from '../src/core/teams.js';

test('normalises Nigerian and English club name variants', () => {
  const table: Array<[string, string]> = [
    ['Enyimba FC', 'enyimba'],
    ['Enyimba of Aba', 'enyimba'],
    ['Rivers United', 'riversutd'],
    ['Kano Pillars', 'kanopillars'],
    ['Kano Pillars FC', 'kanopillars'],
    ['Remo Stars', 'remostars'],
    ['Plateau United', 'plateauutd'],
    ['Man Utd', 'manutd'],
    ['Manchester United', 'manutd'],
    ['Man United', 'manutd'],
    ['Spurs', 'tottenham'],
    ['Tottenham Hotspur', 'tottenham'],
    ['Man City', 'mancity'],
    ['Manchester City', 'mancity'],
  ];
  for (const [raw, expected] of table) {
    assert.equal(normalizeTeamName(raw), expected, raw);
  }
  assert.ok(teamsMatch('Enyimba of Aba', 'Enyimba FC'));
  assert.ok(teamsMatch('Spurs', 'Tottenham Hotspur'));
  assert.ok(!teamsMatch('Arsenal', 'Chelsea'));
});

test('sameFixture requires team match and kickoff within ±10 minutes', () => {
  const ko = new Date('2026-10-31T15:00:00Z');
  const a = { homeTeam: 'Enyimba FC', awayTeam: 'Remo Stars', kickoff: ko };
  assert.ok(sameFixture(a, { homeTeam: 'Enyimba of Aba', awayTeam: 'Remo Stars FC', kickoff: new Date(ko.getTime() + 9 * 60_000) }));
  assert.ok(!sameFixture(a, { ...a, kickoff: new Date(ko.getTime() + 11 * 60_000) }));
  assert.ok(!sameFixture(a, { homeTeam: 'Heartland', awayTeam: 'Remo Stars', kickoff: ko }));
});
