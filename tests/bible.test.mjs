import test from 'node:test';
import assert from 'node:assert/strict';
import { BOOKS,bookCount,neighbor,slugBook,READING_PLAN } from '../src/lib/books.js';
import {normalizeVerses,parseReference} from '../src/lib/bible.js';
test('canonical 66 books have 1189 chapters',()=>{
  assert.equal(BOOKS.length,66);
  assert.equal(BOOKS.reduce((n,[,ch])=>n+ch,0),1189);
});
test('navigate boundaries',()=>{
  assert.deepEqual(neighbor('John',21,1),{book:'Acts',chapter:1});
  assert.deepEqual(neighbor('John',1,-1),{book:'Luke',chapter:24});
  assert.deepEqual(neighbor('Revelation',22,1),{book:'Revelation',chapter:22});
});
test('chapter loading normalization',()=>{
  assert.deepEqual(normalizeVerses([{chapter:3,verse:1,text:' For  God '},{chapter:4,verse:1,text:'Else'}],3),[{verse:1,text:'For God'}]);
});
test('reference selection and plan',()=>{
  assert.equal(parseReference('1 Peter 3:15').book,'1 Peter');
  assert.equal(parseReference('John 99'),null);
  assert.equal(bookCount('Psalms'),150);
  assert.equal(slugBook('1 John'),'1-john');
  assert.equal(READING_PLAN.length,30);
});
