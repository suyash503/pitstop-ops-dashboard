import { escapeCsvValue, toCsv } from './csv';

describe('csv serialisation', () => {
  it('leaves ordinary values alone', () => {
    expect(escapeCsvValue('BK-2026-0001')).toBe('BK-2026-0001');
    expect(escapeCsvValue(4360)).toBe('4360');
  });

  it('quotes values containing a comma', () => {
    // Real case: Indian names in this dataset carry suffixes like ", Jr".
    expect(escapeCsvValue('Mukhopadhyay, Jr')).toBe('"Mukhopadhyay, Jr"');
  });

  it('doubles embedded quotes', () => {
    expect(escapeCsvValue('AC not "cooling"')).toBe('"AC not ""cooling"""');
  });

  it('quotes values containing newlines', () => {
    expect(escapeCsvValue('line one\nline two')).toBe('"line one\nline two"');
  });

  it('renders null and undefined as empty, not as the words', () => {
    // A booking with no completedAt must export as blank, never "null".
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
  });

  it('builds a full document with a header row', () => {
    const csv = toCsv(
      ['Booking ID', 'Customer', 'Amount'],
      [
        ['BK-2026-0001', 'Aarti Deshpande', 2499],
        ['BK-2026-0002', 'Rohan Iyer, Jr', 4999],
      ],
    );

    expect(csv.split('\n')).toEqual([
      'Booking ID,Customer,Amount',
      'BK-2026-0001,Aarti Deshpande,2499',
      'BK-2026-0002,"Rohan Iyer, Jr",4999',
    ]);
  });
});
