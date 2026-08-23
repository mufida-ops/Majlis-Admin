// The standard checklist Mufida already runs by hand for every new book —
// transcribed from her spreadsheet so a new book project starts with the
// full task list instead of an empty one. Bulk-created tasks are left
// unassigned/undated (unlike a manually-added task, which requires both up
// front) since there's no one sensible default owner or date for all ~50 of
// them — they're meant to be picked up and dated via the task edit form.
// Grouped by section (not just one flat list) so the project screen can
// show each part of the workflow as its own collapsible group instead of
// dumping all ~60 tasks at once.
export const BOOK_SECTIONS: { section: string; tasks: string[] }[] = [
  {
    section: 'Book Creation',
    tasks: [
      'Book language focus agreed, book style agreed',
      'Book written in English',
      'Book written in Arabic',
      'Images created for every page',
      'Teacher notes written in English',
      'Teacher notes written in Arabic',
      '"Did you know" page written in English',
      '"Did you know" page written in Arabic',
      'Key words highlighted and listed at the back of the book in English',
      'Key words highlighted and listed at the back of the book in Arabic',
      'About the authors page written in English',
      'About the authors page written in Arabic',
      'Blurb on the back of the book written in English',
      'Blurb on the back of the book written in Arabic'
    ]
  },
  {
    section: 'Book Checking',
    tasks: [
      'English text checked on each page, including the back',
      'Arabic text checked on each page, including the back',
      'Images checked on each page — Mufida',
      'Images checked on each page — Victoria',
      'Text alignment and font size checked on every page',
      'Page numbers positioning checked on each page',
      'Front cover/back cover spread checked'
    ]
  },
  {
    section: 'ISBN',
    tasks: ['Sent for ISBN', 'ISBN approved', 'ISBN information added to the book']
  },
  {
    section: 'Book Box Paper Resources',
    tasks: [
      'Key word A5 cards (~20) agreed',
      'Key word A5 cards written',
      'Game planned',
      'Game written in correct format',
      'Game checked in Arabic',
      'A3 story map (or other) agreed',
      'A3 story map (or other) completed',
      'Key sentence strips agreed',
      'Key sentence strips written in English',
      'Key sentence strips written in Arabic',
      'Teacher activity cards (x5) agreed',
      'Teacher activity card written in English',
      'Teacher activity card written in Arabic'
    ]
  },
  {
    section: 'Hello Chef Guidance',
    tasks: [
      'Hello chef guidance written in English',
      'Hello chef guidance written in Arabic',
      'Hello chef guidance checked in English',
      'Hello chef guidance checked in Arabic'
    ]
  },
  {
    section: 'Props',
    tasks: [
      'Props for the box agreed',
      'Props for the box priced up (total cost, max approx 50 AED)',
      'Props for the box ordered/paid for'
    ]
  },
  {
    section: 'Praveen',
    tasks: [
      'Praveen meeting to design the book box internal layout',
      'Praveen meeting to share the book box design',
      'All paper activities sent to Praveen to print',
      'Book sent to Praveen to print',
      'Props given to Praveen to put in the boxes',
      'Praveen given green light to go ahead',
      'Praveen payment made',
      'Delivery date of completed boxes agreed'
    ]
  },
  {
    section: 'Cultural Box',
    tasks: [
      'Cultural box items agreed (total cost approx 200 AED)',
      'Information cards about the cultural items written in English',
      'Information cards about the cultural items written in Arabic',
      'Cultural box guidance checked in English',
      'Cultural box guidance checked in Arabic',
      'Box size agreed',
      'Box ordered and paid for'
    ]
  }
];

// Flat form — same tasks, paired with their section — for bulk-inserting
// and for counting/backfilling without every caller re-flattening BOOK_SECTIONS.
export const BOOK_TASK_TEMPLATE: { section: string; title: string }[] = BOOK_SECTIONS.flatMap(({ section, tasks }) =>
  tasks.map(title => ({ section, title }))
);
