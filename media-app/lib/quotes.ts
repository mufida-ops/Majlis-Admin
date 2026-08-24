export interface Quote {
  text: string;
  author: string;
}

export const QUOTES: Quote[] = [
  { text: 'Happiness is not something ready made. It comes from your own actions.', author: 'Dalai Lama' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
  { text: 'Small daily improvements are the key to staggering long-term results.', author: 'Anonymous' },
  { text: 'Gratitude turns what we have into enough.', author: 'Anonymous' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Well done is better than well said.', author: 'Benjamin Franklin' },
  { text: "Believe you can and you're halfway there.", author: 'Theodore Roosevelt' },
  { text: 'Joy is the simplest form of gratitude.', author: 'Karl Barth' },
  { text: 'What you do today can improve all your tomorrows.', author: 'Ralph Marston' },
  { text: 'Act as if what you do makes a difference. It does.', author: 'William James' },
  { text: 'Progress, not perfection.', author: 'Anonymous' },
  { text: 'The best way to predict the future is to create it.', author: 'Peter Drucker' },
  { text: 'A year from now you may wish you had started today.', author: 'Karen Lamb' },
  { text: 'Choose a job you love, and you will never have to work a day in your life.', author: 'Confucius' },
  { text: 'Every accomplishment starts with the decision to try.', author: 'Anonymous' },
  { text: "Happiness often sneaks in through a door you didn't know you left open.", author: 'John Barrymore' },
  { text: 'You are capable of more than you know.', author: 'Anonymous' },
  { text: 'Take care of yourself first. Everything else follows.', author: 'Anonymous' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Be the reason someone smiles today.', author: 'Anonymous' },
  { text: 'Difficult roads often lead to beautiful destinations.', author: 'Anonymous' },
  { text: 'Enjoy the little things, for one day you may look back and realize they were the big things.', author: 'Robert Brault' },
  { text: 'Keep your face always toward the sunshine, and shadows will fall behind you.', author: 'Walt Whitman' },
  { text: 'A little progress each day adds up to big results.', author: 'Anonymous' }
];

export function randomQuoteIndex(exclude?: number): number {
  if (QUOTES.length <= 1) return 0;
  let next = Math.floor(Math.random() * QUOTES.length);
  while (next === exclude) next = Math.floor(Math.random() * QUOTES.length);
  return next;
}
