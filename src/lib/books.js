export const BOOKS = [
  ['Genesis',50],['Exodus',40],['Leviticus',27],['Numbers',36],['Deuteronomy',34],
  ['Joshua',24],['Judges',21],['Ruth',4],['1 Samuel',31],['2 Samuel',24],
  ['1 Kings',22],['2 Kings',25],['1 Chronicles',29],['2 Chronicles',36],['Ezra',10],
  ['Nehemiah',13],['Esther',10],['Job',42],['Psalms',150],['Proverbs',31],
  ['Ecclesiastes',12],['Song of Solomon',8],['Isaiah',66],['Jeremiah',52],
  ['Lamentations',5],['Ezekiel',48],['Daniel',12],['Hosea',14],['Joel',3],
  ['Amos',9],['Obadiah',1],['Jonah',4],['Micah',7],['Nahum',3],['Habakkuk',3],
  ['Zephaniah',3],['Haggai',2],['Zechariah',14],['Malachi',4],
  ['Matthew',28],['Mark',16],['Luke',24],['John',21],['Acts',28],
  ['Romans',16],['1 Corinthians',16],['2 Corinthians',13],['Galatians',6],
  ['Ephesians',6],['Philippians',4],['Colossians',4],['1 Thessalonians',5],
  ['2 Thessalonians',3],['1 Timothy',6],['2 Timothy',4],['Titus',3],
  ['Philemon',1],['Hebrews',13],['James',5],['1 Peter',5],['2 Peter',3],
  ['1 John',5],['2 John',1],['3 John',1],['Jude',1],['Revelation',22]
];
export const bookCount = name => BOOKS.find(([b]) => b === name)?.[1] || 1;
export const slugBook = name => name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/-$/,'');
export function neighbor(book, chapter, step) {
  const index = BOOKS.findIndex(([b]) => b === book);
  if(index === -1) return {book:'John',chapter:1};
  const n = Number(chapter) + step;
  if(n > 0 && n <= BOOKS[index][1]) return {book,chapter:n};
  if(step > 0 && index < BOOKS.length-1) return {book:BOOKS[index+1][0],chapter:1};
  if(step < 0 && index > 0) return {book:BOOKS[index-1][0],chapter:BOOKS[index-1][1]};
  return {book,chapter:Number(chapter)};
}
export const READING_PLAN = [
  ...Array.from({length:21},(_,i)=>({book:'John',chapter:i+1})),
  ...[1,8,19,23,27,46,91,103,139].map(chapter=>({book:'Psalms',chapter}))
];
export const CROSS_REFERENCES = {
  'Genesis 1:1': ['John 1:1','Hebrews 11:3','Psalms 33:6'],
  'John 1:1': ['Genesis 1:1','Colossians 1:16','Hebrews 1:2'],
  'John 3:16': ['Romans 5:8','1 John 4:9','Ephesians 2:8'],
  'Psalms 23:1': ['John 10:11','Ezekiel 34:11','Isaiah 40:11'],
  'Romans 8:28': ['Genesis 50:20','Ephesians 1:11','James 1:12'],
  'Ezekiel 1:10': ['Revelation 4:7','Ezekiel 10:14'],
  'Jeremiah 29:11': ['Romans 8:28','Proverbs 3:5'],
  'Philippians 4:6': ['1 Peter 5:7','Matthew 6:25'],
};
