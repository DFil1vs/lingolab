// Проверка действий пользователя без запуска браузера.
// Небольшая замена DOM нужна только тестам; сам сайт использует обычный браузер.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const content = JSON.parse(readFileSync(new URL('../data/content.json', import.meta.url), 'utf8'));

async function createApp(saved = null) {
  const elements = new Map();
  const listeners = new Map();
  const windowListeners = new Map();
  const storage = new Map(saved ? [['lingolab-progress-v1', saved]] : []);
  function element(selector) {
    if (!elements.has(selector)) {
      const classes = new Set(['hidden']);
      elements.set(selector, {
        innerHTML: '', textContent: '', attributes: {}, handlers: {},
        classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) },
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, handler) { this.handlers[name] = handler; },
        focus() {}, scrollIntoView() {}, querySelector: (query) => element(query),
      });
    }
    return elements.get(selector);
  }
  let hash = '';
  const location = {
    get hash() { return hash; },
    set hash(value) { hash = value; windowListeners.get('hashchange')?.(); },
  };
  const context = vm.createContext({
    console, Date, Math, Set, JSON, String, Number, Array,
    document: { querySelector: element, addEventListener: (event, handler) => listeners.set(event, handler) },
    window: { addEventListener: (event, handler) => windowListeners.set(event, handler), scrollTo() {} },
    location, navigator: {}, setTimeout: () => 1, clearTimeout() {},
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    fetch: async () => ({ ok: true, json: async () => structuredClone(content) }),
  });
  vm.runInContext(source.replace(/\ninit\(\);\s*$/, '\nglobalThis.appReady = init();'), context);
  await context.appReady;
  return {
    page: () => element('#main').innerHTML,
    read: (expression) => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context)),
    navigate: (route) => { location.hash = '#' + route; },
    saved: () => storage.get('lingolab-progress-v1'),
    element,
    async click(action, data = {}) {
      const target = { dataset: { action, ...data }, disabled: false };
      await listeners.get('click')({ target: { closest: () => target } });
    },
  };
}

test('a learner can reveal a word, mark it learned and keep progress after reload', async () => {
  const app = await createApp();
  app.navigate('words');
  assert.match(app.page(), /Click to reveal/);
  await app.click('flip');
  assert.match(app.page(), /друг/);
  await app.click('known');
  assert.deepEqual(app.read('state.known'), ['friend']);
  const reloaded = await createApp(app.saved());
  reloaded.navigate('words');
  assert.match(reloaded.page(), /Learned · undo/);
  await reloaded.click('known');
  assert.deepEqual(reloaded.read('state.known'), []);
  await reloaded.click('previous-card');
  assert.equal(reloaded.read('cardIndex'), 7);
  await reloaded.click('next-card');
  assert.equal(reloaded.read('cardIndex'), 0);
  await reloaded.click('topic', { topic: 'travel' });
  assert.match(reloaded.page(), /ticket/);
});

test('quiz feedback, answer locking and the saved score follow the learner’s answers', async () => {
  const app = await createApp();
  app.navigate('practice');
  await app.click('start-vocabulary');
  await app.click('next-question');
  assert.equal(app.read('quiz.index'), 0, 'cannot skip an unanswered question');
  for (let i = 0; i < 6; i++) {
    const question = app.read('quiz.questions[quiz.index]');
    const correct = question.options.indexOf(question.answer);
    const choice = i === 0 ? (correct + 1) % 4 : correct;
    await app.click('answer', { index: String(choice) });
    assert.match(app.page(), i === 0 ? /A little lesson/ : /Nicely done/);
    await app.click('answer', { index: String(correct) });
    assert.equal(app.read('quiz.answers[quiz.index]'), question.options[choice], 'answer cannot be changed');
    await app.click('next-question');
  }
  assert.equal(app.read('quiz.finished'), true);
  assert.equal(app.read('state.quizzes[0].score'), 5);
  assert.equal(app.read('state.daily.count'), 5);
  await app.click('next-question');
  assert.equal(app.read('state.quizzes.length'), 1, 'one quiz is saved once');
  const reloaded = await createApp(app.saved());
  assert.equal(reloaded.read('state.quizzes[0].score'), 5);
});

test('grammar questions contain the correct answer and bilingual feedback', async () => {
  const app = await createApp();
  app.navigate('practice');
  await app.click('start-grammar');
  for (let i = 0; i < 6; i++) {
    const question = app.read('quiz.questions[quiz.index]');
    await app.click('answer', { index: String(question.options.indexOf(question.answer)) });
    assert.ok(app.page().includes(question.explanationRu));
    await app.click('next-question');
  }
  assert.equal(app.read('state.quizzes[0].score'), 6);
  assert.match(app.page(), /A perfect little moment/);
});

test('sentence practice rejects the wrong order and saves each completed sentence once', async () => {
  const app = await createApp();
  app.navigate('sentences');
  const first = content.sentences[0];
  for (let i = first.words.length - 1; i >= 0; i--) await app.click('add-word', { index: String(i) });
  await app.click('check-sentence');
  assert.match(app.page(), /Try a different word order/);
  assert.equal(app.read('state.completedSentences.length'), 0);
  await app.click('reset-sentence');
  for (const item of [...content.sentences, first]) {
    for (let i = 0; i < item.words.length; i++) await app.click('add-word', { index: String(i) });
    await app.click('check-sentence');
    assert.match(app.page(), /That’s a good sentence/);
    await app.click('next-sentence');
  }
  assert.equal(app.read('state.completedSentences.length'), 6);
  assert.equal(app.read('state.daily.count'), 6);
});

test('Russian hints can be toggled, and progress reset needs an explicit second action', async () => {
  const app = await createApp();
  app.navigate('words');
  await app.click('known');
  app.element('#hints-toggle').handlers.click();
  assert.equal(app.read('state.hints'), false);
  assert.equal(app.element('#hints-toggle').attributes['aria-pressed'], 'false');
  app.navigate('project');
  assert.doesNotMatch(app.page(), /Это мой сайт/);
  await app.click('show-reset');
  assert.equal(app.element('#reset-confirm').classList.contains('hidden'), false);
  assert.equal(app.read('state.known.length'), 1);
  await app.click('confirm-reset');
  assert.equal(app.read('state.known.length'), 0);
  assert.equal(app.read('state.hints'), false);
});

test('damaged saved progress does not prevent lessons from loading', async () => {
  const app = await createApp('{not valid JSON');
  assert.match(app.page(), /Hello, learner/);
  assert.equal(app.read('state.known.length'), 0);
});
