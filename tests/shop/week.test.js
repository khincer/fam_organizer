import { mondayOf, addWeeks, isCurrentWeek, weekLabel } from '../../src/shop/week.js'

test('sunday late belongs to the previous monday', () => expect(mondayOf(new Date(2026, 10, 1, 23, 30))).toBe('2026-10-26'))
test('monday just after midnight is that monday', () => expect(mondayOf(new Date(2026, 10, 2, 0, 10))).toBe('2026-11-02'))
test('addWeeks crosses months', () => expect(addWeeks('2026-10-26', 1)).toBe('2026-11-02'))
test('addWeeks backwards', () => expect(addWeeks('2026-11-02', -2)).toBe('2026-10-19'))
test('isCurrentWeek', () => expect(isCurrentWeek('2026-10-26', new Date(2026, 9, 29))).toBe(true))
test('isCurrentWeek false for previous week', () => expect(isCurrentWeek('2026-10-19', new Date(2026, 9, 29))).toBe(false))
test('weekLabel', () => expect(weekLabel('2026-10-26')).toBe('Semana del 26 oct'))
