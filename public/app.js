// Интерфейс: показывает карточки, проверяет ответы и сохраняет прогресс.
const $ = (selector) => document.querySelector(selector);
const main = $('#main');
const STORAGE_KEY = 'lingolab-progress-v1';
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const paths = {
  home: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  book: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',
  layers: '<rect x="6" y="3" width="14" height="17" rx="2"/><path d="M3 7v13a2 2 0 0 0 2 2h11M10 8h6m-6 4h6"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
  project: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="m8 10-2 2 2 2m8-4 2 2-2 2m-3-5-2 7M8 5V3h8v2"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  left: '<path d="m14 6-6 6 6 6"/>',
  right: '<path d="m10 6 6 6-6 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  cross: '<path d="m6 6 12 12M6 18 18 6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 0h8"/>',
  sound: '<path d="m11 4-6 4H2v8h3l6 4V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  flip: '<path d="M4 9a8 8 0 0 1 14-3l2 3m0-5v5h-5M20 15a8 8 0 0 1-14 3l-2-3m0 5v-5h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  sentence: '<path d="M4 5h16v12H9l-5 4V5Zm4 4h8m-8 4h5"/>',
  grammar: '<path d="m3 19 6-14 6 14M5 14h8m4-5h4m-2-2v12"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.book}</svg>`;
const hint = (text, extraClass = '') => state.hints ? `<span class="ru-hint ${extraClass}" lang="ru">${escapeHtml(text)}</span>` : '';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const initialState = () => ({ known: [], quizzes: [], completedSentences: [], daily: { date: today(), count: 0 }, hints: true });
let state = initialState();
let content;
let topicId = 'daily';
let cardIndex = 0;
let revealed = false;
let quiz = null;
let sentence = null;
let storageWorks = true;
let toastTimer;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return;
    const validWordIds = new Set(content.words.map((word) => word.id));
    const validSentenceIds = new Set(content.sentences.map((item) => item.id));
    state.known = [...new Set(Array.isArray(saved.known) ? saved.known.filter((id) => validWordIds.has(id)) : [])];
    state.completedSentences = [...new Set(Array.isArray(saved.completedSentences) ? saved.completedSentences.filter((id) => validSentenceIds.has(id)) : [])];
    state.quizzes = Array.isArray(saved.quizzes) ? saved.quizzes.filter((item) => item && Number.isInteger(item.score) && item.total === 6 && item.score >= 0 && item.score <= item.total).slice(-100) : [];
    state.hints = saved.hints !== false;
    if (saved.daily?.date === today() && Number.isInteger(saved.daily.count) && saved.daily.count >= 0) state.daily.count = Math.min(saved.daily.count, 999);
  } catch { /* Старые или недоступные данные не мешают пользоваться сайтом. */ }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch {
    if (storageWorks) toast('Your browser cannot save progress. It will last until this page closes.');
    storageWorks = false;
  }
}

function addDailyAction() {
  if (state.daily.date !== today()) state.daily = { date: today(), count: 0 };
  state.daily.count = Math.min(state.daily.count + 1, 999);
  saveState();
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3800);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const currentRoute = () => ['home', 'words', 'practice', 'sentences', 'project'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
const topicWords = () => content.words.filter((word) => word.topic === topicId);
const learnedInTopic = (id) => content.words.filter((word) => word.topic === id && state.known.includes(word.id)).length;
const button = (label, action, style = '', attrs = '') => `<button type="button" class="button ${style}" data-action="${action}" ${attrs}>${label}</button>`;
const audioButton = (word) => `<button type="button" class="audio-button" data-action="speak" data-word="${escapeHtml(word)}" aria-label="Listen to ${escapeHtml(word)}" title="Listen to the English pronunciation">${icon('sound')}</button>`;

function render() {
  if (!content) return;
  const route = currentRoute();
  const pages = [ ['home', 'home', 'Overview'], ['words', 'layers', 'Word cards'], ['practice', 'bolt', 'Practice'], ['sentences', 'sentence', 'Build a sentence'], ['project', 'project', 'My project'] ];
  $('#nav').innerHTML = pages.map(([id, symbol, label]) => `<a href="#${id}" class="nav-link ${route === id ? 'active' : ''}" ${route === id ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span>${route === id ? '<span class="nav-dot"></span>' : ''}</a>`).join('');
  $('#breadcrumb').textContent = pages.find(([id]) => id === route)[2];
  $('#hints-toggle').setAttribute('aria-pressed', String(state.hints));
  $('#hints-toggle span').textContent = state.hints ? 'ON' : 'OFF';
  if (route === 'home') renderHome();
  if (route === 'words') renderWords();
  if (route === 'practice') quiz ? renderQuiz() : renderPractice();
  if (route === 'sentences') renderSentence();
  if (route === 'project') renderProject();
}

function heading(eyebrow, title, subtitle, translation = '', tag = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p class="subtitle">${subtitle} ${translation ? hint(translation) : ''}</p></div>${tag ? `<span class="small-tag">${icon('clock')}${tag}</span>` : ''}</div>`;
}

function renderHome() {
  const best = state.quizzes.length ? Math.max(...state.quizzes.map((item) => Math.round(item.score / item.total * 100))) + '%' : '—';
  const dailyCount = state.daily.date === today() ? state.daily.count : 0;
  const dayIndex = [...today()].reduce((sum, char) => sum + char.charCodeAt(0), 0) % content.words.length;
  const dayWord = content.words[dayIndex];
  main.innerHTML = heading('A LITTLE ENGLISH, EVERY DAY', 'Hello, learner<span style="color:#a99cdb">.</span>', 'Good things start with small steps.', 'Большой путь начинается с маленьких шагов.', 'Your pace. Your progress.') + `
    <section class="hero" aria-label="Start learning">
      <div class="hero-line" aria-hidden="true"></div><div class="hero-line second" aria-hidden="true"></div>
      <div class="hero-text"><div class="hero-label">✦ &nbsp; LET’S MAKE IT A HABIT</div><h2>Small steps.<br>Real English.</h2><p>New words, a little practice, a bit more confidence.<br>Your English journey starts right here.</p><a href="#words" class="button white">Start learning ${icon('arrow')}</a></div>
      <div class="hero-art" aria-hidden="true"><span class="art-star">✳</span><span class="art-dot"></span><div class="speech-card"><small>YOUR NEXT CHAPTER</small><strong>Hello, world!</strong><span>/həˈləʊ wɜːld/</span></div><div class="hello-sticker">Let’s talk. ↗</div></div>
    </section>
    <section class="stats-grid" aria-label="Your progress">
      <div class="stat"><div class="icon-box lilac">${icon('layers')}</div><div><p class="stat-label">Words learned</p><strong>${state.known.length}<small>/ 24 words</small></strong></div></div>
      <div class="stat"><div class="icon-box peach">${icon('target')}</div><div><p class="stat-label">Quizzes completed</p><strong>${state.quizzes.length}<small>little wins</small></strong></div></div>
      <div class="stat"><div class="icon-box mint">${icon('trophy')}</div><div><p class="stat-label">Personal best</p><strong>${best}<small>quiz score</small></strong></div></div>
    </section>
    <div class="dashboard-grid"><section><div class="section-heading"><h2>Find your next words</h2><a href="#words" class="text-link">Explore all ${icon('arrow')}</a></div>
      <div class="topic-list">${content.topics.map((topic, index) => `<a href="#words" class="topic-card" data-action="open-topic" data-topic="${topic.id}"><div class="icon-box ${topic.color}">${icon(topic.icon)}</div><div class="topic-info"><div class="topic-kicker">CHAPTER 0${index + 1} · 8 WORDS</div><h3>${topic.title}</h3><p>${topic.description}</p>${hint(topic.translation)}</div><div class="topic-progress">${learnedInTopic(topic.id)} / 8 learned<div class="progress-track"><span style="width:${learnedInTopic(topic.id) / 8 * 100}%"></span></div></div><span class="topic-arrow">${icon('right')}</span></a>`).join('')}</div>
      <div class="practice-banner"><div class="icon-box">${icon('bolt')}</div><div><h3>Put your English to the test.</h3><p>A quick quiz. A stronger memory. You’ve got this.</p></div><a href="#practice" class="text-link">Let’s practise ${icon('arrow')}</a></div>
    </section><aside class="dashboard-aside"><div class="goal-card"><div class="goal-top"><h3>Your next little win</h3><span aria-hidden="true">✧</span></div><div class="goal-title">Five small steps.<br>One good habit.</div><p>Learn a word or get an answer right.<br>Every little step counts.</p><div class="goal-steps" aria-label="${Math.min(dailyCount, 5)} of 5 steps completed">${Array.from({ length: 5 }, (_, i) => `<span class="goal-step ${i < dailyCount ? 'done' : ''}"></span>`).join('')}</div><div class="goal-label"><span>Today’s learning goal</span><span>${Math.min(dailyCount, 5)} / 5</span></div><a href="#${dailyCount >= 5 ? 'practice' : 'words'}" class="button secondary">${dailyCount >= 5 ? 'Goal reached! Keep exploring' : 'Take a small step'} ${icon('arrow')}</a></div>
      <div class="word-of-day"><div class="eyebrow">A WORD FOR YOUR DAY</div><strong>${dayWord.word}</strong><p>${dayWord.ipa}</p>${hint(dayWord.translation, 'hint-block')}${audioButton(dayWord.word)}</div></aside></div>`;
}

function renderWords() {
  const words = topicWords();
  const word = words[cardIndex % words.length];
  const known = state.known.includes(word.id);
  main.innerHTML = heading('MEET YOUR NEW VOCABULARY', 'One word at a time.', 'Look. Listen. Flip. Remember.', 'Нажми на карточку, чтобы увидеть перевод.') + `
    <div class="tabs" role="group" aria-label="Vocabulary topic">${content.topics.map((topic) => `<button type="button" class="tab ${topic.id === topicId ? 'active' : ''}" data-action="topic" data-topic="${topic.id}" aria-pressed="${topic.id === topicId}">${icon(topic.icon)}${topic.title}</button>`).join('')}</div>
    <div class="study-layout"><section class="panel"><div class="study-heading"><span>${content.topics.find((topic) => topic.id === topicId).title}</span>${known ? '<span class="known-badge">✓ Learned</span>' : '<span>Make a new connection</span>'}</div>
      <button type="button" class="flashcard ${revealed ? 'revealed' : ''}" data-action="flip" aria-label="${revealed ? 'Hide translation for' : 'Show translation for'} ${word.word}" aria-pressed="${revealed}">
        <span class="word" lang="en">${word.word}</span><span class="ipa">${word.ipa}</span>
        ${revealed ? `<span class="translation" lang="ru">${word.translation}</span><span class="example">“${word.example}”</span>${hint(word.exampleRu, 'hint-block')}` : `<span class="flip-label">${icon('flip')} Click to reveal the meaning</span>`}
      </button>
      <div class="card-footer">${audioButton(word.word)}<div class="card-arrows"><button class="icon-button" type="button" data-action="previous-card" aria-label="Previous word">${icon('left')}</button><span>${String(cardIndex + 1).padStart(2, '0')} / 08</span><button class="icon-button" type="button" data-action="next-card" aria-label="Next word">${icon('right')}</button></div></div>
      <div class="flash-actions">${button(known ? `${icon('check')} Learned · undo` : `${icon('check')} I know this word`, 'known', known ? 'green' : '')}${button(`Next word ${icon('arrow')}`, 'next-card', 'outline')}</div>
      <p class="study-note">${hint('«I know this word» — отметить слово как выученное. Прогресс сохраняется автоматически.') || 'Mark a word as learned when you feel ready. Your progress saves automatically.'}</p>
    </section><aside class="study-aside"><h3>In this chapter</h3><p>${learnedInTopic(topicId)} of 8 words learned</p><div class="mini-word-list">${words.map((item, i) => `<button type="button" class="mini-word ${i === cardIndex ? 'current' : ''} ${state.known.includes(item.id) ? 'learned' : ''}" data-action="jump-card" data-index="${i}"><span>${item.word}</span><span>${state.known.includes(item.id) ? '✓' : '·'}</span></button>`).join('')}</div><div class="tip-card"><h3>✦ Make it stick</h3><p>Read the example out loud. Then try making your own sentence with the word.</p>${hint('Прочитай пример вслух. Потом придумай своё предложение.', 'hint-block')}</div></aside></div>`;
}

function renderPractice() {
  main.innerHTML = heading('TURN KNOWLEDGE INTO CONFIDENCE', 'A little practice goes far.', 'Pick a challenge. See what you know.', 'Выбери задание и проверь себя.') + `
    <div class="mode-grid"><section class="mode-card"><div class="icon-box lilac">${icon('layers')}</div><h2>Word check</h2><p>A word in English. Four meanings.<br>Can you find the right one?</p>${hint('Выбери правильный перевод английского слова.')}<div class="mode-meta"><span>6 QUESTIONS</span><span>ALL CHAPTERS</span></div>${button(`Let’s begin ${icon('arrow')}`, 'start-vocabulary')}</section>
    <section class="mode-card"><div class="icon-box peach">${icon('grammar')}</div><h2>Grammar lab</h2><p>Small gaps. Big understanding.<br>Find the missing piece.</p>${hint('Заполни пропуск. После ответа появится объяснение.')}<div class="mode-meta"><span>6 QUESTIONS</span><span>BEGINNER</span></div>${button(`Give it a go ${icon('arrow')}`, 'start-grammar', 'secondary')}</section>
    <section class="mode-card"><div class="icon-box mint">${icon('sentence')}</div><h2>Build a sentence</h2><p>A few words, one good sentence.<br>Put the pieces in order.</p>${hint('Нажимай на слова, чтобы собрать предложение.')}<div class="mode-meta"><span>6 SENTENCES</span><span>WORD ORDER</span></div><a href="#sentences" class="button secondary">Piece it together ${icon('arrow')}</a></section></div>
    <div class="info-strip">${icon('info')}<span>No timer. No pressure. A mistake is just another way to learn. ${hint('Ошибаться можно — так мы учимся.')}</span></div>`;
}

function startQuiz(mode) {
  const questions = mode === 'vocabulary' ? shuffle(content.words).slice(0, 6).map((word) => ({
    question: word.word, prompt: 'Choose the correct Russian translation.',
    options: shuffle([word.translation, ...shuffle(content.words.filter((item) => item.id !== word.id)).slice(0, 3).map((item) => item.translation)]),
    answer: word.translation, explanation: `${word.word} = ${word.translation}. ${word.example}`, explanationRu: word.exampleRu,
  })) : shuffle(content.grammar).slice(0, 6).map((item) => ({ ...item, options: shuffle(item.options), prompt: 'Choose the word that completes the sentence.' }));
  quiz = { mode, questions, index: 0, answers: [], finished: false };
  if (currentRoute() !== 'practice') location.hash = 'practice';
  else render();
}

function renderQuiz() {
  if (quiz.finished) return renderResults();
  const item = quiz.questions[quiz.index];
  const selected = quiz.answers[quiz.index];
  const answered = selected !== undefined;
  const correct = selected === item.answer;
  main.innerHTML = heading('LITTLE CHALLENGE, BIG PROGRESS', quiz.mode === 'vocabulary' ? 'Word check' : 'Grammar lab', 'You don’t have to be perfect. Just give it a try.') + `
    <section class="panel quiz-container"><div class="quiz-top"><span>Question ${quiz.index + 1} of ${quiz.questions.length}</span><button class="text-link" type="button" data-action="quit-quiz">${icon('left')} Back to practice</button></div><div class="quiz-progress"><span style="width:${quiz.index / quiz.questions.length * 100}%"></span></div>
    <div class="question-type">${quiz.mode === 'vocabulary' ? 'FIND THE MEANING' : 'FILL THE GAP'}</div><h2 class="question-title">${escapeHtml(item.question)}</h2><p class="question-prompt">${item.prompt} ${hint(quiz.mode === 'vocabulary' ? 'Выбери перевод.' : 'Выбери слово для пропуска.')}</p>
    <div class="answer-grid">${item.options.map((option, i) => `<button type="button" class="answer-option ${answered && option === item.answer ? 'correct' : ''} ${answered && option === selected && !correct ? 'incorrect' : ''}" data-action="answer" data-index="${i}" ${answered ? 'disabled' : ''}><span class="answer-letter">${String.fromCharCode(65 + i)}</span><span>${escapeHtml(option)}</span>${answered && option === item.answer ? icon('check') : ''}</button>`).join('')}</div>
    ${answered ? `<div class="feedback ${correct ? '' : 'error'}" role="status"><strong>${correct ? 'Nicely done!' : 'A little lesson to take with you.'}</strong>${escapeHtml(item.explanation)}${hint(item.explanationRu, 'hint-block')}</div>` : ''}
    <div class="quiz-bottom"><span>${answered ? 'One step closer to more confident English.' : 'Choose one answer to continue.'}</span>${button(quiz.index === 5 ? `See my results ${icon('arrow')}` : `Next question ${icon('arrow')}`, 'next-question', '', answered ? '' : 'disabled')}</div></section>`;
}

function answerQuestion(index) {
  if (!quiz || quiz.finished || quiz.answers[quiz.index] !== undefined) return;
  const question = quiz.questions[quiz.index];
  const answer = question.options[index];
  if (answer === undefined) return;
  quiz.answers[quiz.index] = answer;
  if (answer === question.answer) addDailyAction();
  render();
  main.querySelector('[data-action="next-question"]').focus({ preventScroll: true });
}

function nextQuestion() {
  if (!quiz || quiz.finished || quiz.answers[quiz.index] === undefined) return;
  if (quiz.index < quiz.questions.length - 1) quiz.index++;
  else {
    quiz.finished = true;
    const score = quiz.questions.filter((question, i) => question.answer === quiz.answers[i]).length;
    state.quizzes.push({ score, total: quiz.questions.length, mode: quiz.mode, date: today() });
    state.quizzes = state.quizzes.slice(-100);
    saveState();
  }
  render();
  main.focus({ preventScroll: true });
}

function renderResults() {
  const score = quiz.questions.filter((item, i) => item.answer === quiz.answers[i]).length;
  main.innerHTML = heading('ANOTHER LITTLE WIN', 'Look at you go.', 'Your quiz is complete. Let’s see what you learned.') + `
    <section class="panel quiz-container"><div class="result-hero"><div class="result-icon">${icon('trophy')}</div><h2>${score === 6 ? 'A perfect little moment!' : score >= 3 ? 'You’re making progress!' : 'A good place to start.'}</h2><div class="result-score">${score}<small> / 6</small></div><p>${score === 6 ? 'Every answer right. Keep that curiosity going.' : 'Review the answers below. Then come back for another try.'}</p>${hint('Результат сохранён. Ниже можно повторить правильные ответы.', 'hint-block')}<div class="result-actions">${button(`Try another quiz ${icon('flip')}`, 'retry-quiz')}${button('Back to practice', 'quit-quiz', 'outline')}</div></div><div class="review-list">${quiz.questions.map((item, i) => `<div class="review-item ${item.answer === quiz.answers[i] ? '' : 'wrong'}">${icon(item.answer === quiz.answers[i] ? 'check' : 'cross')}<div><strong>${escapeHtml(item.question)}</strong><small>Correct answer: ${escapeHtml(item.answer)}${item.answer !== quiz.answers[i] ? ` · Your answer: ${escapeHtml(quiz.answers[i])}` : ''}</small>${hint(item.explanationRu)}</div></div>`).join('')}</div></section>`;
}

function newSentence(index = 0) {
  const item = content.sentences[index];
  let order = shuffle(item.words.map((_, i) => i));
  if (order.every((value, i) => value === i)) order = order.reverse();
  sentence = { index, order, chosen: [], checked: false, correct: false };
}

function renderSentence() {
  if (!sentence) newSentence();
  const item = content.sentences[sentence.index];
  main.innerHTML = heading('PUT THE PIECES TOGETHER', 'Make your words work.', 'Tap the words to build an English sentence.', 'Нажми на выбранное слово ещё раз, чтобы убрать его.') + `
    <section class="panel quiz-container"><div class="quiz-top"><span>Sentence ${sentence.index + 1} of ${content.sentences.length}</span><span>${state.completedSentences.length} / 6 completed</span></div><div class="quiz-progress"><span style="width:${state.completedSentences.length / 6 * 100}%"></span></div><div class="question-type">TRANSLATE INTO ENGLISH</div><h2 class="question-title" lang="ru">${item.translation}</h2><p class="question-prompt">Make the English sentence below.</p>
    <div class="sentence-target" aria-label="Your sentence">${sentence.chosen.length ? sentence.chosen.map((id, i) => `<button type="button" class="word-chip" data-action="remove-word" data-index="${i}" ${sentence.correct ? 'disabled' : ''} aria-label="Remove ${escapeHtml(item.words[id])}">${escapeHtml(item.words[id])}</button>`).join('') : '<span class="sentence-placeholder">Your sentence starts here…</span>'}</div>
    <div class="word-bank" aria-label="Available words">${sentence.order.map((id) => `<button type="button" class="word-chip" data-action="add-word" data-index="${id}" ${sentence.chosen.includes(id) || sentence.correct ? 'disabled' : ''}>${escapeHtml(item.words[id])}</button>`).join('')}</div>
    ${sentence.checked ? `<div class="feedback ${sentence.correct ? '' : 'error'}" role="status"><strong>${sentence.correct ? 'That’s a good sentence!' : 'Almost. Try a different word order.'}</strong>${sentence.correct ? item.words.join(' ') : 'Start with the subject. Look at the capital letter and the punctuation.'}${hint(sentence.correct ? 'Всё правильно! Можно перейти к следующему предложению.' : 'Начни с подлежащего. Обрати внимание на заглавную букву и знак в конце.', 'hint-block')}</div>` : ''}
    <div class="quiz-bottom">${button('Start over', 'reset-sentence', 'outline')}${sentence.correct ? button(`Next sentence ${icon('arrow')}`, 'next-sentence') : button(`Check sentence ${icon('check')}`, 'check-sentence', '', sentence.chosen.length === item.words.length ? '' : 'disabled')}</div>
    <p class="study-note">${hint('Подсказка: слово с заглавной буквы ставим первым, слово с точкой или вопросительным знаком — последним.') || 'Tip: a capital letter starts the sentence. A full stop or question mark finishes it.'}</p></section>`;
}

const speechLines = [
  ['This is my English learning website.', 'Это мой сайт для изучения английского языка.'],
  ['Its name is LingoLab.', 'Он называется LingoLab.'],
  ['I made this project with ChatGPT.', 'Я сделал этот проект с помощью ChatGPT.'],
  ['It has word cards, quizzes and sentence tasks.', 'На нём есть карточки слов, тесты и задания с предложениями.'],
  ['You can see a translation and an example.', 'Можно посмотреть перевод и пример.'],
  ['The website checks your answers.', 'Сайт проверяет твои ответы.'],
  ['It saves your progress in the browser.', 'Он сохраняет твой прогресс в браузере.'],
  ['Node.js and Express run the local server.', 'Node.js и Express запускают локальный сервер.'],
  ['HTML gives the page its structure.', 'HTML задаёт структуру страницы.'],
  ['CSS makes it look nice.', 'CSS делает её красивой.'],
  ['JavaScript makes the buttons work.', 'JavaScript заставляет кнопки работать.'],
  ['This project shows how AI can help us learn.', 'Этот проект показывает, как ИИ может помогать нам учиться.'],
];

function renderProject() {
  main.innerHTML = heading('BUILT WITH CURIOSITY', 'A small project. A useful idea.', 'Learn the words. Understand the code. Tell your story.', 'Простое объяснение проекта для защиты.') + `
    <div class="project-intro"><section class="panel"><div class="eyebrow">HUMAN IDEA + AI HELP</div><h2>A learning website,<br>made together.</h2><p>LingoLab is a school project about learning English with technology. ChatGPT helped create the code, design and exercises. The student can explore the site, practise English and explain how it works.</p>${hint('ChatGPT помог написать код, придумать оформление и задания. На сайте заранее подготовленные уроки. Подключения к ChatGPT API здесь нет.', 'hint-block')}</section><section class="tech-stack" aria-label="Project technologies"><div class="tech-row"><span class="tech-mark">JS</span><div><strong>Node.js + Express</strong><p>Run the server on your computer.</p></div></div><div class="tech-row"><span class="tech-mark">&lt;/&gt;</span><div><strong>HTML + CSS</strong><p>Give the page its structure and style.</p></div></div><div class="tech-row"><span class="tech-mark">{ }</span><div><strong>JavaScript + localStorage</strong><p>Make it interactive. Remember progress.</p></div></div></section></div>
    <section class="project-section"><div class="section-heading"><h2>Your one-minute presentation</h2>${button('Copy English text', 'copy-script', 'outline')}</div><div class="script-grid">${speechLines.map(([en, ru], i) => `<div class="script-line"><div class="line-number">${String(i + 1).padStart(2, '0')}</div><p lang="en">${en}</p>${hint(ru)}</div>`).join('')}</div></section>
    <section class="project-section"><h2>How it works, simply</h2><div class="flow-explanation"><strong>1.</strong> You open localhost in your browser.<br><strong>2.</strong> Express sends the page and lesson data.<br><strong>3.</strong> JavaScript shows words and checks answers.<br><strong>4.</strong> The browser remembers your progress.${hint('Браузер запрашивает сайт → сервер отдаёт файлы и данные → JavaScript обрабатывает действия → прогресс сохраняется в этом браузере.', 'hint-block')}</div></section>
    <section class="project-section"><h2>A few questions you might hear</h2><div class="qa-list"><details><summary>Why did you choose this project?</summary><p>I wanted to make a simple and useful tool for learning English.</p>${hint('Я хотел сделать простой и полезный инструмент для изучения английского.', 'hint-block')}</details><details><summary>How did ChatGPT help you?</summary><p>ChatGPT helped me write the code, design the pages and create the exercises.</p>${hint('ChatGPT помог написать код, оформить страницы и создать задания.', 'hint-block')}</details><details><summary>What is localhost?</summary><p>It is an address for a server on my own computer.</p>${hint('Это адрес сервера на моём компьютере.', 'hint-block')}</details><details><summary>Where is the progress saved?</summary><p>It is saved in localStorage in this browser. It does not need an account.</p>${hint('В localStorage этого браузера. В другом браузере прогресс будет отдельным.', 'hint-block')}</details><details><summary>Does the website use ChatGPT live?</summary><p>No. ChatGPT helped build the project. The website uses prepared lessons.</p>${hint('Нет. ChatGPT помог создать проект. Сам сайт использует готовые учебные материалы.', 'hint-block')}</details></div></section>
    <div class="reset-row"><div><h3>A fresh start for your demo</h3><p>Clear your saved words, quiz results and daily goal.</p></div>${button('Reset progress', 'show-reset', 'outline')}</div><div id="reset-confirm" class="reset-confirm hidden"><p>Reset all LingoLab progress in this browser? This cannot be undone.</p><div class="result-actions">${button('Yes, reset progress', 'confirm-reset')}${button('Keep my progress', 'cancel-reset', 'outline')}</div></div>`;
}

function speak(word) {
  if (!('speechSynthesis' in window)) return toast('Pronunciation is not available in this browser. Try Chrome or Edge.');
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-GB';
  utterance.rate = 0.85;
  const englishVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.startsWith('en'));
  if (englishVoice) utterance.voice = englishVoice;
  utterance.onerror = (event) => {
    if (!['canceled', 'interrupted'].includes(event.error)) toast('Voice unavailable. Use the pronunciation written on the card.');
  };
  window.speechSynthesis.speak(utterance);
}

// Один обработчик для кнопок. data-action сообщает, какое действие выполнить.
document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled || !content) return;
  const action = target.dataset.action;
  const index = Number(target.dataset.index);
  if (action === 'speak') return speak(target.dataset.word);
  if (action === 'open-topic' || action === 'topic') {
    if (!content.topics.some((topic) => topic.id === target.dataset.topic)) return;
    topicId = target.dataset.topic; cardIndex = 0; revealed = false;
    if (action === 'topic') render();
    else if (currentRoute() === 'words') render();
    return;
  }
  if (action === 'flip') { revealed = !revealed; render(); main.querySelector('[data-action="flip"]').focus({ preventScroll: true }); }
  if (action === 'next-card' || action === 'previous-card') {
    cardIndex = (cardIndex + (action === 'next-card' ? 1 : -1) + topicWords().length) % topicWords().length;
    revealed = false; render();
  }
  if (action === 'jump-card') { cardIndex = index; revealed = false; render(); }
  if (action === 'known') {
    const word = topicWords()[cardIndex];
    if (state.known.includes(word.id)) { state.known = state.known.filter((id) => id !== word.id); saveState(); }
    else { state.known.push(word.id); addDailyAction(); toast(`“${word.word}” added to your learned words. Nice work!`); }
    render();
  }
  if (action === 'start-vocabulary') startQuiz('vocabulary');
  if (action === 'start-grammar') startQuiz('grammar');
  if (action === 'answer') answerQuestion(index);
  if (action === 'next-question') nextQuestion();
  if (action === 'quit-quiz') { quiz = null; render(); }
  if (action === 'retry-quiz' && quiz) startQuiz(quiz.mode);
  if (action === 'add-word' && sentence && !sentence.correct && !sentence.chosen.includes(index)) { sentence.chosen.push(index); sentence.checked = false; render(); }
  if (action === 'remove-word' && sentence && !sentence.correct) { sentence.chosen.splice(index, 1); sentence.checked = false; render(); }
  if (action === 'reset-sentence') { newSentence(sentence.index); render(); }
  if (action === 'check-sentence' && sentence) {
    const item = content.sentences[sentence.index];
    if (sentence.chosen.length !== item.words.length) return;
    sentence.checked = true;
    sentence.correct = sentence.chosen.every((id, i) => id === i);
    if (sentence.correct && !state.completedSentences.includes(item.id)) { state.completedSentences.push(item.id); addDailyAction(); }
    render();
  }
  if (action === 'next-sentence') { newSentence((sentence.index + 1) % content.sentences.length); render(); }
  if (action === 'copy-script') {
    try { await navigator.clipboard.writeText(speechLines.map(([en]) => en).join('\n')); toast('English presentation copied!'); }
    catch { toast('Select and copy the English sentences, or use PRESENTATION.md in the project folder.'); }
  }
  if (action === 'show-reset') { $('#reset-confirm').classList.remove('hidden'); $('#reset-confirm').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  if (action === 'cancel-reset') $('#reset-confirm').classList.add('hidden');
  if (action === 'confirm-reset') { const hints = state.hints; state = initialState(); state.hints = hints; quiz = null; sentence = null; saveState(); render(); toast('A fresh start. Your progress has been reset.'); }
});

$('#hints-toggle').addEventListener('click', () => { state.hints = !state.hints; saveState(); render(); });
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); main.focus({ preventScroll: true }); });

async function init() {
  try {
    const response = await fetch('/api/content');
    if (!response.ok) throw new Error('Lessons could not be loaded.');
    content = await response.json();
    loadState();
    render();
  } catch {
    main.innerHTML = `<section class="panel error-panel"><h2>Let’s get your lessons back.</h2><p lang="ru">Проверь, что сервер запущен командой npm start, и открой http://localhost:3000. Не открывай index.html двойным щелчком.</p><button type="button" class="button" id="reload-button">Try again</button></section>`;
    $('#reload-button').addEventListener('click', () => location.reload());
  }
}
init();
