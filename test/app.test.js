import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { app } from '../server.js';

let server;
let baseUrl;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((resolve) => server.close(resolve)); });

test('the home page and its assets load through Express', async () => {
  for (const [path, mime, expected] of [
    ['/', 'text/html', 'LingoLab'],
    ['/styles.css', 'text/css', '@media'],
    ['/app.js', 'javascript', 'function renderQuiz'],
    ['/favicon.svg', 'image/svg+xml', '<svg'],
  ]) {
    const response = await fetch(baseUrl + path);
    assert.equal(response.status, 200, path);
    assert.ok(response.headers.get('content-type').includes(mime), path);
    assert.ok((await response.text()).includes(expected), path);
  }
});

test('the API returns the complete learning material', async () => {
  const response = await fetch(baseUrl + '/api/content');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.topics.length, 3);
  assert.equal(data.words.length, 24);
  assert.equal(data.grammar.length, 12);
  assert.equal(data.sentences.length, 6);
  assert.deepEqual(await (await fetch(baseUrl + '/api/health')).json(), { status: 'ok' });
});

test('server source, package data and unknown pages are not exposed', async () => {
  for (const path of ['/server.js', '/package.json', '/data/content.json', '/does-not-exist', '/.env']) {
    const response = await fetch(baseUrl + path);
    assert.equal(response.status, 404, path);
  }
});

test('each chapter has eight complete and distinct word cards', () => {
  const data = JSON.parse(readFileSync(new URL('../data/content.json', import.meta.url), 'utf8'));
  assert.equal(new Set(data.words.map((word) => word.id)).size, data.words.length);
  assert.equal(new Set(data.words.map((word) => word.translation)).size, data.words.length);
  for (const topic of data.topics) assert.equal(data.words.filter((word) => word.topic === topic.id).length, 8);
  for (const word of data.words) {
    assert.ok(data.topics.some((topic) => topic.id === word.topic));
    for (const key of ['word', 'translation', 'ipa', 'example', 'exampleRu']) assert.ok(word[key]?.trim(), `${word.id}: ${key}`);
  }
});

test('grammar questions have one valid answer and a bilingual explanation', () => {
  const data = JSON.parse(readFileSync(new URL('../data/content.json', import.meta.url), 'utf8'));
  for (const item of data.grammar) {
    assert.equal(item.options.length, 4);
    assert.equal(new Set(item.options).size, 4);
    assert.equal(item.options.filter((option) => option === item.answer).length, 1);
    assert.ok(item.question.includes('___'));
    assert.ok(item.explanation && item.explanationRu);
  }
});

test('sentence tasks have unique IDs, translations and correctly punctuated solutions', () => {
  const data = JSON.parse(readFileSync(new URL('../data/content.json', import.meta.url), 'utf8'));
  assert.equal(new Set(data.sentences.map((item) => item.id)).size, data.sentences.length);
  for (const item of data.sentences) {
    assert.ok(item.translation);
    assert.ok(item.words.length >= 4);
    assert.match(item.words[0], /^[A-Z]/);
    assert.match(item.words.at(-1), /[.?]$/);
    assert.equal(item.words.filter((word) => /[.?]$/.test(word)).length, 1);
  }
});
