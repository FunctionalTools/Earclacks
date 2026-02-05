const STORAGE_KEY = 'earclacks_games_v1';
const STORAGE_ACTIVE_KEY = 'earclacks_active_game_v1';

function createNewGameEntry(name, mode){
  const id = `game_${Date.now()}_${Math.floor(Math.random()*10000)}`;
  return {id, name, mode: mode || 'sandbox', createdAt: Date.now(), endedAt: null, state: null};
}

function loadGamesFromStorage(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch{
    return [];
  }
}

function saveGamesToStorage(games, activeGameId){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  if(activeGameId) localStorage.setItem(STORAGE_ACTIVE_KEY, activeGameId);
  else localStorage.removeItem(STORAGE_ACTIVE_KEY);
}

function safeGameSummary(entry){
  const state = entry?.state;
  if(!state) return '';
  const balls = Array.isArray(state.balls) ? state.balls.length : 0;
  const teams = state.teams ? Object.keys(state.teams).length : 0;
  return `${balls} tanks · ${teams} teams`;
}

function render(){
  const list = document.getElementById('gamesList');
  const gamesCountEl = document.getElementById('gamesCount');
  let games = loadGamesFromStorage();
  let activeGameId = localStorage.getItem(STORAGE_ACTIVE_KEY);

  gamesCountEl.textContent = String(games.length);
  list.innerHTML = '';

  if(games.length === 0){
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No games saved yet. Open the game and press “New Game” to start tracking.';
    list.appendChild(empty);
    return;
  }

  games.forEach(gameEntry => {
    const row = document.createElement('div');
    row.className = 'game-row' + (gameEntry.id === activeGameId ? ' active' : '');
    const created = gameEntry.createdAt ? new Date(gameEntry.createdAt).toLocaleString() : 'Unknown';
    const ended = gameEntry.endedAt ? new Date(gameEntry.endedAt).toLocaleString() : 'Active';
    const summary = safeGameSummary(gameEntry);
    row.innerHTML = `
      <div class="game-info">
        <div class="game-title">${gameEntry.name || 'Untitled Game'}</div>
        <div class="game-meta">Mode ${(gameEntry.mode || 'sandbox').toUpperCase()} · Created ${created} · ${ended}${summary ? ` · ${summary}` : ''}</div>
      </div>
      <div class="game-actions"></div>
    `;

    const actions = row.querySelector('.game-actions');

    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn btn-secondary btn-small';
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', () => {
      activeGameId = gameEntry.id;
      saveGamesToStorage(games, activeGameId);
      window.location.href = 'play.html';
    });

    const renameBtn = document.createElement('button');
    renameBtn.className = 'btn btn-outline btn-small';
    renameBtn.textContent = 'Rename';
    renameBtn.addEventListener('click', () => {
      const newName = prompt('Rename game', gameEntry.name || '');
      if(newName && newName.trim().length > 0){
        gameEntry.name = newName.trim();
        saveGamesToStorage(games, activeGameId);
        render();
      }
    });

    const endBtn = document.createElement('button');
    endBtn.className = 'btn btn-warning btn-small';
    endBtn.textContent = 'End';
    endBtn.disabled = !!gameEntry.endedAt;
    endBtn.addEventListener('click', () => {
      gameEntry.endedAt = Date.now();
      saveGamesToStorage(games, activeGameId);
      render();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-small';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      const ok = confirm(`Delete "${gameEntry.name || 'this game'}"?`);
      if(!ok) return;
      games = games.filter(g => g.id !== gameEntry.id);
      if(activeGameId === gameEntry.id){
        activeGameId = games[0]?.id || null;
      }
      saveGamesToStorage(games, activeGameId);
      render();
    });

    actions.appendChild(loadBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(endBtn);
    actions.appendChild(deleteBtn);
    list.appendChild(row);
  });
}

document.getElementById('openGame').addEventListener('click', () => {
  window.location.href = 'play.html';
});

document.getElementById('clearHistory').addEventListener('click', () => {
  const ok = confirm('Clear ALL saved games? This cannot be undone.');
  if(!ok) return;
  saveGamesToStorage([], null);
  render();
});

function openModeModal(){
  const modal = document.getElementById('modeModal');
  modal.classList.add('open');
}
function closeModeModal(){
  const modal = document.getElementById('modeModal');
  modal.classList.remove('open');
}

const newGameBtn = document.getElementById('newGameFromHome');
if(newGameBtn) newGameBtn.addEventListener('click', openModeModal);

const closeMode = document.getElementById('closeMode');
if(closeMode) closeMode.addEventListener('click', closeModeModal);

const modeModal = document.getElementById('modeModal');
if(modeModal){
  modeModal.addEventListener('click', (e) => {
    if(e.target.classList.contains('modal-overlay')) closeModeModal();
  });
  modeModal.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      let games = loadGamesFromStorage();
      const entry = createNewGameEntry(`Game ${games.length + 1}`, mode);
      games.unshift(entry);
      saveGamesToStorage(games, entry.id);
      closeModeModal();
      window.location.href = 'play.html';
    });
  });
}

render();
