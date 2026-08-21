// A shared "quote of the day" — same line for every member of a workspace
// on the same calendar day, computed locally from the date (no table, no
// network call, nothing to keep in sync). Deliberately original lines
// rather than quotes attributed to real people, so nothing here is ever a
// misquote. Tone: motivational leadership, secular, and — as asked —
// sometimes restorative rather than always "push harder": rest, boundaries
// and self-trust count as leadership too, not just output.

const QUOTES: string[] = [
  'Rest is not the opposite of ambition — it is what makes ambition sustainable.',
  'You do not have to be loud to be certain.',
  'A good decision made calmly beats a fast one made anxious.',
  'Progress you cannot see is still progress.',
  'Say the honest thing gently. Both parts matter.',
  'You are allowed to build this at a pace you can actually keep.',
  'Small, kept promises are what trust is made of.',
  'The version of you who is tired still gets to lead well.',
  'Not every day needs a breakthrough. Some days just need showing up.',
  'Softness and standards are not opposites.',
  'You are the person who follows through. Remember that on the hard days.',
  'Ask for what you need before you run out of the strength to ask.',
  'A boundary held kindly is still a boundary.',
  'The work will wait one evening. Your rest will not always be offered twice.',
  'You do not need to carry it alone to prove it matters to you.',
  'Steady is a kind of brave.',
  'What you built today, someone will stand on tomorrow.',
  'Clarity is kinder than false comfort.',
  'You are allowed to be proud of something small.',
  'Trust the version of the plan that lets you sleep.',
  'Leadership is mostly just deciding, again, to keep going.',
  'You do not owe anyone a performance of ease.',
  'The quiet work counts even when no one claps for it.',
  'Two tired women who keep showing up will outlast a lot of louder plans.',
  'It is okay to close the laptop before the list is finished.',
  'Good instincts got you here. Trust them a little more today.',
  'You can hold high standards and a soft morning at the same time.',
  'The right partner makes the hard days survivable. You have one.',
  'Ask the question instead of guessing what they meant.',
  'Momentum is built in ordinary Tuesdays, not big Mondays.',
  'You are not behind. You are exactly as far as today allowed.',
  'Say no to the thing that is not yours to carry.',
  'A tired yes is worth less than an honest not yet.',
  'You get to define what "enough for today" looks like.',
  'The plan can change. The care behind it does not have to.',
  'You built something from a conversation. That is not small.',
  "Let today's win be quiet if it needs to be.",
  'Doing less, well, beats doing everything, badly.',
  'You are allowed to need a slower week.',
  'The right thing said kindly is still the right thing.',
  'You do not have to earn your rest with exhaustion first.',
  'Confidence is just practice wearing a calmer face.',
  'A patient founder builds something that lasts.',
  'You can be proud of the version of this that actually got done.',
  'Two steady hands are stronger than one frantic one.',
  'You are learning this as you build it — that is the job, not a flaw in you.',
  'Choose the sustainable version of today over the impressive one.',
  'Every follow-up you send is a promise kept.',
  'You are allowed to protect your evenings. The work respects boundaries better than you think.',
  'Some days leadership just looks like being kind to yourself first.',
  'The right people forgive an honest delay.',
  'You do not have to solve it tonight.',
  'A calm no now saves a resentful yes later.',
  'What feels ordinary today is someone else\'s "how did you build that."',
  'You are not required to be endlessly available to be reliable.',
  'Slow and finished beats fast and half-done.',
  'Take the win. You do not have to immediately look for the next one.',
  'Being gentle with yourself is not the same as lowering the bar.',
  'You show up for this even on the days it is hard. That is the whole job.',
  'Today only needs your honest effort, not your best-ever effort.',
  'Two people who trust each other can carry almost anything, one piece at a time.'
];

function localCalendarDate(date: Date): { year: number; month: number; day: number } {
  return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() };
}

function dayIndex(date: Date): number {
  const { year, month, day } = localCalendarDate(date);
  const daysSinceEpoch = Math.floor(Date.UTC(year, month, day) / 86400000);
  return ((daysSinceEpoch % QUOTES.length) + QUOTES.length) % QUOTES.length;
}

/**
 * The same quote for everyone on the same calendar day, derived from the
 * date alone — no shared state needed for two members to see the same line.
 */
export function quoteOfTheDay(date: Date = new Date()): string {
  return QUOTES[dayIndex(date)];
}
