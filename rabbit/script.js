/* ============================================================
   谁是兔子 · 主逻辑
   ============================================================ */

/* ---------- 全局状态 ---------- */
let state = {
  currentStoryId: null,
  remainingRounds: 20,
  collectedClues: [],     // 已收集线索的索引
  usedQuestions: [],      // 已使用的预设问题索引
  revealed: false,
};

/* 本地存储 */
const STORAGE_KEY = 'rabbit_game_progress';

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { solved: {}, carrots: 5 }; // 初始赠送5根胡萝卜
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

let progress = loadProgress();

/* ---------- 工具函数 ---------- */
function $(id) { return document.getElementById(id); }

function updateNavStats() {
  const solvedCount = Object.keys(progress.solved).length;
  $('carrotCount').textContent = progress.carrots;
  $('solvedCount').textContent = solvedCount;
  $('totalCount').textContent = STORIES.length;
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
  $(pageId).classList.add('active');
  // 高亮对应导航
  const map = { homePage: 0, progressPage: 1, rulesPage: 2 };
  if (map[pageId] !== undefined) {
    document.querySelectorAll('.nav-link')[map[pageId]].classList.add('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showHome() {
  showPage('homePage');
  renderStoryGrid();
  updateNavStats();
}

function showProgress() {
  showPage('progressPage');
  renderProgressPage();
}

function showRules() {
  showPage('rulesPage');
}

/* ---------- 首页：故事列表 ---------- */
let currentFilter = 'all';

function renderStoryGrid() {
  const grid = $('storyGrid');
  grid.innerHTML = '';

  let list = STORIES;
  if (currentFilter === 'solved') {
    list = STORIES.filter(s => progress.solved[s.id]);
  } else if (currentFilter !== 'all') {
    list = STORIES.filter(s => s.difficulty === currentFilter);
  }

  list.forEach(story => {
    const solved = progress.solved[story.id];
    const stars = solved ? solved.stars : 0;
    const diff = DIFFICULTY_MAP[story.difficulty];

    const card = document.createElement('div');
    card.className = 'story-card';
    card.onclick = () => openStory(story.id);
    card.innerHTML = `
      <div class="card-top">
        <div class="card-emoji">${story.emoji}</div>
        <span class="card-tag ${diff.class}">${diff.label}</span>
      </div>
      <div class="card-title">${story.title}</div>
      <div class="card-preview">${story.face.split('\n')[0]} ${story.face.split('\n')[1] || ''}...</div>
      <div class="card-bottom">
        <span class="card-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>
        ${solved ? '<span class="card-solved">✓ 已通关</span>' : '<span>未通关</span>'}
      </div>
    `;
    grid.appendChild(card);
  });

  if (list.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-mute);">暂无符合条件的谜题</div>';
  }
}

/* 筛选按钮 */
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('filter-btn')) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.dataset.filter;
    renderStoryGrid();
  }
});

/* ---------- 进入游戏 ---------- */
function openStory(storyId) {
  const story = STORIES.find(s => s.id === storyId);
  if (!story) return;

  state = {
    currentStoryId: storyId,
    remainingRounds: 20,
    collectedClues: [],
    usedQuestions: [],
    revealed: false,
  };

  // 重置 UI
  $('storyTitle').textContent = story.title;
  $('storyDifficulty').textContent = DIFFICULTY_MAP[story.difficulty].label;
  $('storyDifficulty').className = 'panel-tag ' + DIFFICULTY_MAP[story.difficulty].class;
  $('storyFace').textContent = story.face;
  $('roundsNum').textContent = state.remainingRounds;
  $('clueTotal').textContent = story.clues.length;
  $('clueCount').textContent = 0;
  $('clueList').innerHTML = '<div class="clue-empty">尚未获得任何线索</div>';
  $('progressFill').style.width = '0%';
  $('progressTip').textContent = '收集线索以解锁真相';
  const revealBtn = $('btn-reveal');
  if (revealBtn) revealBtn.disabled = false;

  // 重置对话
  $('chatBox').innerHTML = `
    <div class="chat-msg system">
      欢迎来到推理现场。我是主持人，你只能得到三种回答：<span class="ans-yes">是</span> / <span class="ans-no">否</span> / <span class="ans-na">无关</span>。试着找出"兔子"是谁。
    </div>
  `;

  // 渲染预设问题
  const pq = $('presetQuestions');
  pq.innerHTML = '';
  story.presetQuestions.forEach((q, idx) => {
    const btn = document.createElement('button');
    btn.className = 'preset-q';
    btn.textContent = q.text;
    btn.onclick = () => askPreset(idx);
    pq.appendChild(btn);
  });

  $('askInput').value = '';

  showPage('gamePage');
}

/* ---------- 提问处理 ---------- */
function addChat(type, text, clueLabel) {
  const box = $('chatBox');
  const msg = document.createElement('div');
  msg.className = 'chat-msg ' + type;
  if (type === 'player') {
    msg.textContent = '你：' + text;
  } else if (type === 'host') {
    msg.innerHTML = '主持人：' + text;
  } else {
    msg.innerHTML = text;
  }
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

function formatAnswer(ans) {
  if (ans === 'yes') return '<span class="ans-yes">是</span>';
  if (ans === 'no') return '<span class="ans-no">否</span>';
  return '<span class="ans-na">无关</span>';
}

/* 扣减提问次数 */
function consumeRound() {
  state.remainingRounds--;
  $('roundsNum').textContent = state.remainingRounds;
  if (state.remainingRounds <= 5) {
    $('roundsNum').style.color = 'var(--red)';
  }
  if (state.remainingRounds <= 0 && !state.revealed) {
    addChat('system', '⏰ 提问次数已用尽。你可以用 🥕 兑换线索，或直接查看真相。');
  }
}

/* 解锁线索 */
function unlockClue(clueText) {
  if (!clueText) return;
  const story = STORIES.find(s => s.id === state.currentStoryId);
  const idx = story.clues.indexOf(clueText);
  if (idx === -1 || state.collectedClues.includes(idx)) return;

  state.collectedClues.push(idx);
  renderClues();
}

function renderClues() {
  const story = STORIES.find(s => s.id === state.currentStoryId);
  const list = $('clueList');
  $('clueCount').textContent = state.collectedClues.length;

  if (state.collectedClues.length === 0) {
    list.innerHTML = '<div class="clue-empty">尚未获得任何线索</div>';
  } else {
    list.innerHTML = '';
    state.collectedClues.sort((a, b) => a - b).forEach(idx => {
      const div = document.createElement('div');
      div.className = 'clue-item';
      div.innerHTML = `<span class="clue-label">线索 ${idx + 1}</span>${story.clues[idx]}`;
      list.appendChild(div);
    });
  }

  const pct = Math.round((state.collectedClues.length / story.clues.length) * 100);
  $('progressFill').style.width = pct + '%';

  if (state.collectedClues.length >= Math.ceil(story.clues.length * 0.6)) {
    $('progressTip').textContent = '🔥 线索充足，可以揭开真相了！';
    $('progressTip').style.color = 'var(--green)';
  } else {
    $('progressTip').textContent = `再收集 ${Math.ceil(story.clues.length * 0.6) - state.collectedClues.length} 条线索可解锁真相`;
    $('progressTip').style.color = '';
  }
}

/* 预设问题 */
function askPreset(idx) {
  if (state.remainingRounds <= 0 && state.collectedClues.length < Math.ceil(STORIES.find(s => s.id === state.currentStoryId).clues.length * 0.6)) {
    addChat('system', '⏰ 提问次数已用尽。请兑换线索或查看真相。');
    return;
  }
  if (state.usedQuestions.includes(idx)) return;

  const story = STORIES.find(s => s.id === state.currentStoryId);
  const q = story.presetQuestions[idx];
  state.usedQuestions.push(idx);

  // 标记已用
  const btns = document.querySelectorAll('.preset-q');
  if (btns[idx]) btns[idx].classList.add('used');

  addChat('player', q.text);
  consumeRound();

  setTimeout(() => {
    addChat('host', formatAnswer(q.answer));
    if (q.clue) {
      unlockClue(q.clue);
      addChat('system', '🧩 你获得了一条新线索！');
    }
  }, 400);
}

/* 自由提问 */
function askQuestion() {
  const input = $('askInput');
  const text = input.value.trim();
  if (!text) return;

  if (state.remainingRounds <= 0) {
    addChat('system', '⏰ 提问次数已用尽。请兑换线索或查看真相。');
    return;
  }

  const story = STORIES.find(s => s.id === state.currentStoryId);

  // 匹配关键词规则
  let matched = null;
  for (const rule of story.keywordRules) {
    if (rule.keywords.some(kw => text.includes(kw))) {
      matched = rule;
      break;
    }
  }

  addChat('player', text);
  input.value = '';
  consumeRound();

  setTimeout(() => {
    if (matched) {
      addChat('host', formatAnswer(matched.answer));
      if (matched.clue) {
        unlockClue(matched.clue);
        addChat('system', '🧩 你获得了一条新线索！');
      }
    } else {
      // 未匹配，根据语气猜测
      const hasQuestion = text.includes('吗') || text.includes('?') || text.includes('？') || text.includes('是否') || text.includes('是不是');
      if (hasQuestion) {
        addChat('host', formatAnswer('na'));
        addChat('system', '主持人摇了摇头：这个问题与案件核心无关。');
      } else {
        addChat('host', '请用疑问句提问，例如"兔子是人类吗？"');
        state.remainingRounds++; // 不扣次数
        $('roundsNum').textContent = state.remainingRounds;
      }
    }
  }, 400);
}

/* 回车提问 */
$('askInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') askQuestion();
});

/* ---------- 兑换线索 ---------- */
function buyClue() {
  const story = STORIES.find(s => s.id === state.currentStoryId);
  if (progress.carrots < 1) {
    addChat('system', '🥕 胡萝卜不足！通关谜题可获得胡萝卜。');
    return;
  }
  // 找一个未解锁的线索
  const available = story.clues.map((c, i) => i).filter(i => !state.collectedClues.includes(i));
  if (available.length === 0) {
    addChat('system', '所有线索已收集完毕！');
    return;
  }
  progress.carrots--;
  const idx = available[Math.floor(Math.random() * available.length)];
  unlockClue(story.clues[idx]);
  addChat('system', `🧩 你用 1 根 🥕 换得了线索 ${idx + 1}！`);
  updateNavStats();
  saveProgress(progress);
}

/* ---------- 查看真相 ---------- */
function tryReveal() {
  const story = STORIES.find(s => s.id === state.currentStoryId);
  const need = Math.ceil(story.clues.length * 0.6);

  if (state.collectedClues.length < need && state.remainingRounds > 0) {
    addChat('system', `🔒 线索不足。还需要 ${need - state.collectedClues.length} 条线索，或用尽提问次数后可强行查看。`);
    return;
  }

  revealTruth();
}

function revealTruth() {
  const story = STORIES.find(s => s.id === state.currentStoryId);
  state.revealed = true;

  // 计算评分
  const clueRatio = state.collectedClues.length / story.clues.length;
  const roundRatio = state.remainingRounds / 20;
  let stars = 1;
  if (clueRatio >= 0.6 && roundRatio >= 0.4) stars = 3;
  else if (clueRatio >= 0.4 || roundRatio >= 0.2) stars = 2;

  // 记录进度
  const prev = progress.solved[story.id];
  const isPerfect = stars === 3;
  if (!prev || prev.stars < stars) {
    progress.solved[story.id] = { stars, date: new Date().toLocaleDateString() };
    // 奖励胡萝卜
    const reward = stars + (isPerfect ? 2 : 0);
    progress.carrots += reward;
  }
  saveProgress(progress);
  updateNavStats();

  // 显示弹窗
  $('revealTitle').textContent = `真相大白 · ${story.title}`;
  $('revealBody').textContent = story.truth;

  const carrotReward = stars + (isPerfect ? 2 : 0);
  $('revealScore').innerHTML = `
    <div class="score-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
    <div class="score-detail">
      收集线索：${state.collectedClues.length}/${story.clues.length} ·
      剩余提问：${state.remainingRounds} ·
      获得 🥕 ×${carrotReward}
    </div>
  `;
  $('revealModal').classList.add('show');
}

function closeReveal() {
  $('revealModal').classList.remove('show');
}

/* ---------- 进度页 ---------- */
function renderProgressPage() {
  $('pSolved').textContent = Object.keys(progress.solved).length;
  $('pCarrots').textContent = progress.carrots;

  let totalStars = 0, perfect = 0;
  Object.values(progress.solved).forEach(s => {
    totalStars += s.stars;
    if (s.stars === 3) perfect++;
  });
  $('pStars').textContent = totalStars;
  $('pPerfect').textContent = perfect;

  const list = $('progressList');
  list.innerHTML = '';
  STORIES.forEach(story => {
    const solved = progress.solved[story.id];
    const item = document.createElement('div');
    item.className = 'progress-item';
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:24px;">${story.emoji}</span>
        <div>
          <div class="pi-title">${story.title}</div>
          <div style="font-size:12px;color:var(--text-mute);">${solved ? '通关于 ' + solved.date : '尚未通关'}</div>
        </div>
      </div>
      <div class="pi-stars">${solved ? '★'.repeat(solved.stars) + '☆'.repeat(3 - solved.stars) : '☆☆☆'}</div>
    `;
    list.appendChild(item);
  });
}

/* ---------- 初始化 ---------- */
updateNavStats();
renderStoryGrid();
