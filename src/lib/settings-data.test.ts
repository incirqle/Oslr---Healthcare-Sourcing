import { describe, expect, it } from 'vitest';
import { monthlyMemberSpend } from './settings-data';
describe('shared workspace credit reporting', () => {
  it('counts only the selected member debits, never pool grants or expiry', () => {
    expect(monthlyMemberSpend([{user_id:'a',credits:-15,kind:'agent_build'}, {user_id:'a',credits:-3,kind:'phone'}, {user_id:'a',credits:500,kind:'grant'}, {user_id:'b',credits:-2,kind:'personal_email'}, {user_id:'a',credits:-100,kind:'expired'}], 'a')).toBe(18);
  });
});