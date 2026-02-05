// EARCLACKS COMPLETE GAME ENGINE
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
resize(); window.addEventListener('resize', resize);

const rand = (a,b) => Math.random()*(b-a)+a;
let gameMode = 'sandbox';
let gameState = { balls: [], projectiles: [], turrets: [], teams: {}, nextTeamId: 1, nextBallId: 1, shrinkRadius: null, spawnX: W/2, spawnY: H/2 };
let selectedBall = null;
let gameRunning = false;
let gamePaused = false;
let gameSpeed = 1;

// WEAPON DEFINITIONS - ALL 22 WEAPONS
const WEAPONS = {
  sword: { name: 'Sword', color: '#ff6464', desc: 'Increases damage by 1 every hit rotating blade', dmgGrowth: 1, rotSpeed: 0.1 },
  dagger: { name: 'Dagger', color: '#02fc02', desc: 'Increases rotation speed by attack speed boost per hit', rotGrowth: 0.05, rotSpeed: 0.15 },
  bow: { name: 'Bow', color: '#ffff02', desc: 'Releases arrows depending on arrow count increases by 1', arrows: 3, fireRate: 90 },
  spear: { name: 'Spear', color: '#00feff', desc: 'Increases length and damage by half every hit', lengthGrowth: 0.5, dmgGrowth: 0.5 },
  scythe: { name: 'Scythe', color: '#ab58fd', desc: 'Increases poison damage by 1 every hit', poison: 1, rotSpeed: 0.08 },
  shield: { name: 'Shield', color: '#b58101', desc: 'Deflects projectiles gets wider every parry can copy abilities', width: 30, widthGrowth: 2 },
  scepter: { name: 'Scepter', color: '#fda7eb', desc: 'Lifesteals opponents by half more every hit heals teammates', lifesteal: 0.5, lsGrowth: 0.5 },
  unarmed: { name: 'Unarmed', color: '#cfcfcf', desc: 'Increases max speed by 1 damage depends on speed resets on hit', maxSpd: 3, spdGrowth: 1 },
  boots: { name: 'Boots', color: '#acacac', desc: 'Like unarmed but smaller hitbox faster speed scaling', maxSpd: 4, spdGrowth: 1.2 },
  staff: { name: 'Staff', color: '#4677ff', desc: 'Releases fireballs that increase damage and size by half', fireSize: 1, fireGrowth: 0.5 },
  shuriken: { name: 'Shuriken', color: '#858d08', desc: 'Throws shurikens which gain 1 more bounce every hit', bounces: 1, bounceGrowth: 1 },
  wrench: { name: 'Wrench', color: '#fea801', desc: 'Creates turrets upon hitting an enemy spawns helpers', turretCD: 120 },
  hammer: { name: 'Hammer', color: '#d24e86', desc: 'Increases max rotation speed by 1 damage depends on rotation', maxRot: 0.1, rotGrowth: 0.02 },
  katana: { name: 'Katana', color: '#82ffbb', desc: 'Increases slashes by 1 every parry does damage over time', slashes: 1, slashGrowth: 1 },
  flask: { name: 'Flask', color: '#009a04', desc: 'Throws flasks creating spills gaining more DPS over time', spillDmg: 0.5, spillGrowth: 0.2 },
  lance: { name: 'Lance', color: '#feed9a', desc: 'Gains 2 joust damage every hit occasionally jousts with invincibility', joustDmg: 5, joustCD: 180 },
  grimoire: { name: 'Grimoire', color: '#888888', desc: 'Copies opponents on hit creating minions with same weapon', minionHP: 20, hpGrowth: 1 },
  axe: { name: 'Axe', color: '#cf1301', desc: 'Increases critical hit chance by 2 percent crit damage equals chance', critChance: 2, critGrowth: 2 },
  boomerang: { name: 'Boomerang', color: '#c5c500', desc: 'Throws boomerang in arc every 3 seconds increases damage by 2', boomerangCD: 180, dmgGrowth: 2 },
  flail: { name: 'Flail', color: '#e2947c', desc: 'Unpredictably flings flail increasing size and damage by half', flailSize: 1, flailGrowth: 0.5 },
  crossbow: { name: 'Crossbow', color: '#7cb900', desc: 'Shoots 1 arrow every second arrow damage scales by 1', fireRate: 60, dmgGrowth: 1 },
  torch: { name: 'Torch', color: '#983a8e', desc: 'Creates flames every hit lifetime increases by 1 second', flameLife: 60, lifeGrowth: 60 },
  sniper: { name: 'Sniper', color: '#1a1a1a', desc: 'Shoots devastating bullet every 5 seconds instantly kills any target', fireRate: 300, oneHitKill: true }
};

// BLOCK BREAKER BALLS
const BLOCK_BREAKERS = {
  grower: { name: 'Grower', color: '#4ade80', desc: 'Gets bigger every bounce', sizeGrowth: 1.5 },
  speedy: { name: 'Speedy', color: '#60a5fa', desc: 'Gets faster every bounce', spdGrowth: 0.2 },
  duplicator: { name: 'Duplicator', color: '#f472b6', desc: 'Duplicates every ball on field', dupCD: 600 },
  gravitron: { name: 'Gravitron', color: '#a78bfa', desc: 'Gets heavier every bounce', massGrowth: 0.5 },
  sticky: { name: 'Sticky', color: '#fbbf24', desc: 'Gets stickier every bounce slows others', stickyGrowth: 0.1 },
  lazer: { name: 'Lazer', color: '#ef4444', desc: 'Has interval that decreases over time', laserCD: 120, cdDecrease: 5 },
  slammy: { name: 'Slammy', color: '#f97316', desc: 'Gets stronger every bounce', dmgGrowth: 2 },
  splodey: { name: 'Splodey', color: '#dc2626', desc: 'Throws bombs every few seconds amount increases', bombs: 1, bombGrowth: 1 },
  fibonacci: { name: 'Fibonacci', color: '#fcd34d', desc: 'Damage increases based on fibonacci sequence', fibIndex: 1 },
  goldenRatio: { name: 'Golden Ratio', color: '#fde047', desc: 'Grows by factor of 1.618 every bounce', growthFactor: 1.618 },
  multiplier: { name: 'Multiplier', color: '#facc15', desc: 'Grows by factor of 2 every bounce', growthFactor: 2 }
};

// Ball Class
class Ball {
  constructor(x, y, type) {
    this.id = gameState.nextBallId++;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.type = type;
    this.weapon = WEAPONS[type] || BLOCK_BREAKERS[type];
    this.size = 20;
    this.health = 100;
    this.maxHealth = 100;
    this.damage = 1;
    this.speed = 3;
    this.teamId = null;
    this.stats = { hits: 0, kills: 0, dmgDealt: 0 };
    this.weaponStats = {}; // weapon-specific stats
    this.rotAngle = 0;
    this.cooldowns = {};
    
    // Initialize weapon-specific stats
    if (this.weapon) {
      if (type === 'bow') this.weaponStats.arrows = 3;
      if (type === 'shield') this.weaponStats.width = 30;
      if (type === 'shuriken') this.weaponStats.bounces = 1;
      if (type === 'katana') this.weaponStats.slashes = 1;
      if (type === 'grimoire') this.weaponStats.minions = [];
      if (type === 'axe') this.weaponStats.critChance = 0;
      if (type === 'fibonacci') { this.weaponStats.fibIndex = 1; this.weaponStats.fibSeq = [1, 1]; }
    }
    
    // Set initial velocity
    let angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    
    this.color = this.weapon ? this.weapon.color : '#888';
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.rotAngle += 0.1;
    
    // Boundaries
    let radius = this.size;
    if (this.x < radius) { this.x = radius; this.vx *= -0.8; this.onBounce(); }
    if (this.x > W - radius) { this.x = W - radius; this.vx *= -0.8; this.onBounce(); }
    if (this.y < radius) { this.y = radius; this.vy *= -0.8; this.onBounce(); }
    if (this.y > H - radius) { this.y = H - radius; this.vy *= -0.8; this.onBounce(); }
    
    // Update weapon cooldowns
    for (let key in this.cooldowns) {
      if (this.cooldowns[key] > 0) this.cooldowns[key]--;
    }
    
    // Weapon behaviors
    this.updateWeapon();
  }
  
  onBounce() {
    // Block breaker ball effects on bounce
    if (this.type === 'grower') this.size += 1.5;
    if (this.type === 'speedy') this.speed += 0.2;
    if (this.type === 'gravitron') this.size += 0.5;
    if (this.type === 'slammy') this.damage += 2;
    if (this.type === 'goldenRatio') this.size *= 1.05;
    if (this.type === 'multiplier') this.size *= 1.02;
  }
  
  onHit(target) {
    this.stats.hits++;
    let dmg = this.damage;
    
    // Weapon effects on hit
    if (this.type === 'sword') { this.damage += 1; }
    if (this.type === 'dagger') { if (!this.weaponStats.rotSpeed) this.weaponStats.rotSpeed = 0.15; this.weaponStats.rotSpeed += 0.05; }
    if (this.type === 'bow') { this.weaponStats.arrows = (this.weaponStats.arrows || 3) + 1; }
    if (this.type === 'spear') { this.damage += 0.5; this.size += 0.5; }
    if (this.type === 'scythe') { if (!this.weaponStats.poison) this.weaponStats.poison = 0; this.weaponStats.poison += 1; target.poison = (target.poison || 0) + this.weaponStats.poison; }
    if (this.type === 'shield') { this.weaponStats.width = (this.weaponStats.width || 30) + 2; }
    if (this.type === 'scepter') { let heal = 0.5 + (this.weaponStats.lifesteal || 0); this.health = Math.min(this.maxHealth, this.health + heal); this.weaponStats.lifesteal = (this.weaponStats.lifesteal || 0) + 0.5; }
    if (this.type === 'shuriken') { this.weaponStats.bounces = (this.weaponStats.bounces || 1) + 1; }
    if (this.type === 'hammer') { this.weaponStats.maxRot = (this.weaponStats.maxRot || 0.1) + 0.02; }
    if (this.type === 'katana') { this.weaponStats.slashes = (this.weaponStats.slashes || 1) + 1; }
    if (this.type === 'axe') { this.weaponStats.critChance = (this.weaponStats.critChance || 0) + 2; if (Math.random() * 100 < this.weaponStats.critChance) dmg *= (this.weaponStats.critChance / 10); }
    if (this.type === 'boomerang') { this.damage += 2; }
    if (this.type === 'crossbow') { this.damage += 1; }
    if (this.type === 'flail') { this.damage += 0.5; this.size += 0.5; }
    if (this.type === 'fibonacci') {
      let idx = this.weaponStats.fibIndex || 1;
      let seq = this.weaponStats.fibSeq || [1, 1];
      while (seq.length <= idx + 1) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
      dmg = seq[idx];
      this.weaponStats.fibIndex = idx + 1;
      this.weaponStats.fibSeq = seq;
    }
    
    target.health -= dmg;
    this.stats.dmgDealt += dmg;
    if (target.health <= 0) this.stats.kills++;
  }
  
  updateWeapon() {
    // Periodic weapon effects
    if (this.type === 'bow' && (!this.cooldowns.bow || this.cooldowns.bow <= 0)) {
      this.cooldowns.bow = 90;
      let arrows = this.weaponStats.arrows || 3;
      for (let i = 0; i < arrows; i++) {
        let angle = Math.atan2(this.vy, this.vx) + (Math.random() - 0.5) * 0.3;
        gameState.projectiles.push(new Projectile(this.x, this.y, Math.cos(angle) * 6, Math.sin(angle) * 6, 1, this.teamId, 'arrow', '#ffff02'));
      }
    }
    
    if (this.type === 'staff' && (!this.cooldowns.staff || this.cooldowns.staff <= 0)) {
      this.cooldowns.staff = 120;
      let angle = Math.atan2(this.vy, this.vx);
      let size = 1 + (this.weaponStats.fireSize || 0);
      gameState.projectiles.push(new Projectile(this.x, this.y, Math.cos(angle) * 5, Math.sin(angle) * 5, 2 + size, this.teamId, 'fireball', '#ff6600', size * 5));
      this.weaponStats.fireSize = (this.weaponStats.fireSize || 1) + 0.5;
    }
    
    if (this.type === 'shuriken' && (!this.cooldowns.shuriken || this.cooldowns.shuriken <= 0)) {
      this.cooldowns.shuriken = 100;
      let angle = Math.atan2(this.vy, this.vx);
      let bounces = this.weaponStats.bounces || 1;
      gameState.projectiles.push(new Projectile(this.x, this.y, Math.cos(angle) * 7, Math.sin(angle) * 7, 1.5, this.teamId, 'shuriken', '#858d08', 8, bounces));
    }
    
    if (this.type === 'wrench' && (!this.cooldowns.wrench || this.cooldowns.wrench <= 0)) {
      this.cooldowns.wrench = 120;
      gameState.turrets.push(new Turret(this.x + rand(-30, 30), this.y + rand(-30, 30), this.teamId, this.color, this.id));
    }
    
    if (this.type === 'flask' && (!this.cooldowns.flask || this.cooldowns.flask <= 0)) {
      this.cooldowns.flask = 150;
      let angle = Math.random() * Math.PI * 2;
      gameState.projectiles.push(new Projectile(this.x, this.y, Math.cos(angle) * 4, Math.sin(angle) * 4, 0.5, this.teamId, 'flask', '#009a04'));
    }
    
    if (this.type === 'boomerang' && (!this.cooldowns.boomerang || this.cooldowns.boomerang <= 0)) {
      this.cooldowns.boomerang = 180;
      let angle = Math.atan2(this.vy, this.vx);
      gameState.projectiles.push(new Projectile(this.x, this.y, Math.cos(angle) * 5, Math.sin(angle) * 5, this.damage, this.teamId, 'boomerang', '#c5c500', 10));
    }
    
    if (this.type === 'crossbow' && (!this.cooldowns.crossbow || this.cooldowns.crossbow <= 0)) {
      this.cooldowns.crossbow = 60;
      let angle = Math.atan2(this.vy, this.vx);
      gameState.projectiles.push(new Projectile(this.x, this.y, Math.cos(angle) * 8, Math.sin(angle) * 8, this.damage, this.teamId, 'arrow', '#7cb900'));
    }
    
    if (this.type === 'torch' && (!this.cooldowns.torch || this.cooldowns.torch <= 0)) {
      this.cooldowns.torch = 100;
      gameState.projectiles.push(new Projectile(this.x, this.y, 0, 0, 0.3, this.teamId, 'flame', '#983a8e', 15, 0, 60 + (this.weaponStats.flameLife || 0)));
      this.weaponStats.flameLife = (this.weaponStats.flameLife || 0) + 60;
    }
    
    if (this.type === 'sniper' && (!this.cooldowns.sniper || this.cooldowns.sniper <= 0)) {
      this.cooldowns.sniper = 300;
      // Find nearest enemy to shoot at
      let target = null, minDist = 999999;
      for (let b of gameState.balls) {
        if (b.teamId === this.teamId || b.health <= 0 || b === this) continue;
        let d = Math.hypot(b.x - this.x, b.y - this.y);
        if (d < minDist) { minDist = d; target = b; }
      }
      if (target) {
        let angle = Math.atan2(target.y - this.y, target.x - this.x);
        gameState.projectiles.push(new Projectile(this.x, this.y, Math.cos(angle) * 12, Math.sin(angle) * 12, 9999, this.teamId, 'sniper', '#1a1a1a', 8));
      }
    }
    
    if (this.type === 'lazer' && (!this.cooldowns.lazer || this.cooldowns.lazer <= 0)) {
      let cd = 120 - Math.min(100, this.stats.hits * 5);
      this.cooldowns.lazer = cd;
      let angle = Math.atan2(this.vy, this.vx);
      gameState.projectiles.push(new Projectile(this.x, this.y, Math.cos(angle) * 10, Math.sin(angle) * 10, 3, this.teamId, 'laser', '#ef4444', 8));
    }
    
    if (this.type === 'splodey' && (!this.cooldowns.splodey || this.cooldowns.splodey <= 0)) {
      this.cooldowns.splodey = 200;
      let bombs = 1 + Math.floor(this.stats.hits / 5);
      for (let i = 0; i < bombs; i++) {
        let angle = Math.random() * Math.PI * 2;
        gameState.projectiles.push(new Projectile(this.x, this.y, Math.cos(angle) * 3, Math.sin(angle) * 3, 5, this.teamId, 'bomb', '#dc2626', 12));
      }
    }
    
    if (this.type === 'duplicator' && (!this.cooldowns.duplicator || this.cooldowns.duplicator <= 0)) {
      this.cooldowns.duplicator = 600;
      let oldCount = gameState.balls.length;
      for (let i = 0; i < oldCount && gameState.balls.length < 200; i++) {
        let b = gameState.balls[i];
        let nb = new Ball(b.x + rand(-50, 50), b.y + rand(-50, 50), b.type);
        nb.teamId = b.teamId;
        nb.size = b.size * 0.8;
        gameState.balls.push(nb);
      }
    }
    
    // Poison damage
    if (this.poison && this.poison > 0) {
      this.health -= this.poison * 0.02;
      this.poison *= 0.99;
    }
  }
  
  draw(ctx) {
    // Draw ball
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw health number
    ctx.fillStyle = '#000';
    ctx.font = `bold ${Math.floor(this.size * 0.6)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(this.health), this.x, this.y);
    
    // Draw weapon effects
    if (this.type === 'sword' || this.type === 'dagger' || this.type === 'hammer') {
      let len = this.size + 15;
      let angle = this.rotAngle * (this.weaponStats.rotSpeed || 1);
      ctx.beginPath();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 4;
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(angle) * len, this.y + Math.sin(angle) * len);
      ctx.stroke();
    }
    
    if (this.type === 'shield') {
      let w = this.weaponStats.width || 30;
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x - w / 2, this.y - this.size - 5, w, 10);
    }
    
    if (this.type === 'scythe') {
      let len = this.size + 20;
      ctx.beginPath();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3;
      ctx.arc(this.x + Math.cos(this.rotAngle) * len, this.y + Math.sin(this.rotAngle) * len, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    if (selectedBall === this) {
      ctx.beginPath();
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 3;
      ctx.arc(this.x, this.y, this.size + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// Projectile Class
class Projectile {
  constructor(x, y, vx, vy, damage, teamId, type = 'bullet', color = '#fff', size = 5, bounces = 0, lifetime = 180) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.damage = damage;
    this.teamId = teamId;
    this.type = type;
    this.color = color;
    this.size = size;
    this.bounces = bounces;
    this.lifetime = lifetime;
    this.age = 0;
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.age++;
    
    if (this.type === 'flame') {
      // Stationary flame
      this.vx = 0; this.vy = 0;
    }
    
    // Bounce
    if (this.bounces > 0) {
      if (this.x < this.size || this.x > W - this.size) { this.vx *= -1; this.bounces--; }
      if (this.y < this.size || this.y > H - this.size) { this.vy *= -1; this.bounces--; }
    }
    
    return this.age < this.lifetime && this.x > 0 && this.x < W && this.y > 0 && this.y < H;
  }
  
  draw(ctx) {
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Turret Class
class Turret {
  constructor(x, y, teamId, color, ownerBallId) {
    this.x = x; this.y = y; this.teamId = teamId; this.color = color;
    this.ownerBallId = ownerBallId;
    this.cooldown = 0;
    this.health = 50;
  }
  
  update() {
    if (this.cooldown > 0) this.cooldown--;
    if (this.cooldown <= 0) {
      this.cooldown = 60;
      // Find nearest enemy
      let target = null, minDist = 999999;
      for (let b of gameState.balls) {
        if (b.teamId === this.teamId || b.health <= 0) continue;
        let d = Math.hypot(b.x - this.x, b.y - this.y);
        if (d < minDist) { minDist = d; target = b; }
      }
      if (target) {
        let angle = Math.atan2(target.y - this.y, target.x - this.x);
        gameState.projectiles.push(new Projectile(this.x, this.y, Math.cos(angle) * 5, Math.sin(angle) * 5, 2, this.teamId, 'bullet', this.color));
      }
    }
  }
  
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - 10, this.y - 10, 20, 20);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x - 10, this.y - 10, 20, 20);
  }
}

// GAME LOGIC
function spawnBalls() {
  let type = document.getElementById('ballType').value;
  let qty = parseInt(document.getElementById('qty').value) || 1;
  let teamId = parseInt(document.getElementById('teamSelect').value) || null;
  
  for (let i = 0; i < qty; i++) {
    let b = new Ball(gameState.spawnX + rand(-30, 30), gameState.spawnY + rand(-30, 30), type);
    b.teamId = teamId === 0 ? null : teamId;
    gameState.balls.push(b);
  }
}

function clearMap() {
  gameState.balls = [];
  gameState.projectiles = [];
  gameState.turrets = [];
}

function togglePause() {
  gamePaused = !gamePaused;
  let btn = document.getElementById('pauseBtn');
  btn.textContent = gamePaused ? '▶️ Resume' : '⏸️ Pause';
}

function updateSpeed(value) {
  gameSpeed = parseInt(value);
  document.getElementById('speedLabel').textContent = gameSpeed + 'x';
}

function createTeam() {
  let name = document.getElementById('teamName').value || `Team ${gameState.nextTeamId}`;
  let color = `hsl(${Math.random() * 360}, 70%, 60%)`;
  gameState.teams[gameState.nextTeamId] = { name, color, members: [] };
  gameState.nextTeamId++;
  updateTeamSelects();
  updateSidebar();
}

function updateTeamSelects() {
  let selects = [document.getElementById('teamSelect'), document.getElementById('stat-teamSelect')];
  selects.forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '<option value="0">Individual</option>';
    for (let id in gameState.teams) {
      sel.innerHTML += `<option value="${id}">${gameState.teams[id].name}</option>`;
    }
  });
}

function updateSidebar() {
  let teamsHTML = '';
  for (let id in gameState.teams) {
    let t = gameState.teams[id];
    let count = gameState.balls.filter(b => b.teamId == id).length;
    teamsHTML += `<div class="team-item" style="border-left: 4px solid ${t.color}">${t.name} (${count})</div>`;
  }
  document.getElementById('teamsList').innerHTML = teamsHTML;
  
  // Selected ball info
  if (selectedBall && selectedBall.health > 0) {
    let html = `<div style="margin-top:20px; padding:15px; background:rgba(255,255,255,0.1); border-radius:8px;">
      <h4>${WEAPONS[selectedBall.type]?.name || selectedBall.type}</h4>
      <div class="ball-stat"><span>Health:</span><input type="number" value="${selectedBall.health.toFixed(1)}" onchange="selectedBall.health=parseFloat(this.value)"></div>
      <div class="ball-stat"><span>Damage:</span><input type="number" value="${selectedBall.damage.toFixed(1)}" onchange="selectedBall.damage=parseFloat(this.value)"></div>
      <div class="ball-stat"><span>Size:</span><input type="number" value="${selectedBall.size.toFixed(1)}" onchange="selectedBall.size=parseFloat(this.value)"></div>
      <div class="ball-stat"><span>Speed:</span><input type="number" value="${selectedBall.speed.toFixed(1)}" onchange="selectedBall.speed=parseFloat(this.value)"></div>
      <div class="ball-stat"><span>Hits:</span><span>${selectedBall.stats.hits}</span></div>
      <div class="ball-stat"><span>Kills:</span><span>${selectedBall.stats.kills}</span></div>
      <button onclick="selectedBall.health=0; selectedBall=null;" style="width:100%; margin-top:10px; background:#ef4444;">Delete Ball</button>
    </div>`;
    document.getElementById('ballInfo').innerHTML = html;
  } else {
    document.getElementById('ballInfo').innerHTML = '';
    selectedBall = null;
  }
}

function gameLoop() {
  if (!gameRunning) return;
  
  if (!gamePaused) {
    // Run multiple updates based on game speed
    for (let speedIteration = 0; speedIteration < gameSpeed; speedIteration++) {
      updateGame();
    }
  }
  
  // Always draw even when paused
  drawGame();
  
  updateSidebar();
  requestAnimationFrame(gameLoop);
}

function updateGame() {
  // Battle Royale shrink
  if (gameMode === 'battleroyale') {
    if (!gameState.shrinkRadius) gameState.shrinkRadius = Math.min(W, H) / 2;
    gameState.shrinkRadius -= 0.5;
    
    // Damage balls outside
    gameState.balls.forEach(b => {
      if (Math.hypot(b.x - W / 2, b.y - H / 2) > gameState.shrinkRadius) {
        b.health -= 0.5;
      }
    });
  }
  
  // Update entities
  // Remove turrets of dead balls before removing the balls
  let deadBallIds = gameState.balls.filter(b => b.health <= 0).map(b => b.id);
  if (deadBallIds.length > 0) {
    gameState.turrets = gameState.turrets.filter(t => t.ownerBallId === undefined || !deadBallIds.includes(t.ownerBallId));
  }
  gameState.balls = gameState.balls.filter(b => b.health > 0);
  gameState.balls.forEach(b => b.update());
  
  gameState.projectiles = gameState.projectiles.filter(p => p.update());
  
  gameState.turrets = gameState.turrets.filter(t => t.health > 0);
  gameState.turrets.forEach(t => t.update());
  
  // Collisions
  for (let i = 0; i < gameState.balls.length; i++) {
    for (let j = i + 1; j < gameState.balls.length; j++) {
      let a = gameState.balls[i], b = gameState.balls[j];
      if (a.teamId === b.teamId && a.teamId !== null) continue;
      let dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < a.size + b.size) {
        // Bounce
        let dx = b.x - a.x, dy = b.y - a.y;
        let angle = Math.atan2(dy, dx);
        let sin = Math.sin(angle), cos = Math.cos(angle);
        let vx1 = a.vx * cos + a.vy * sin;
        let vy1 = a.vy * cos - a.vx * sin;
        let vx2 = b.vx * cos + b.vy * sin;
        let vy2 = b.vy * cos - b.vx * sin;
        [vx1, vx2] = [vx2, vx1];
        a.vx = vx1 * cos - vy1 * sin;
        a.vy = vy1 * cos + vx1 * sin;
        b.vx = vx2 * cos - vy2 * sin;
        b.vy = vy2 * cos + vx2 * sin;
        
        // Separate
        let overlap = (a.size + b.size - dist) / 2;
        a.x -= Math.cos(angle) * overlap;
        a.y -= Math.sin(angle) * overlap;
        b.x += Math.cos(angle) * overlap;
        b.y += Math.sin(angle) * overlap;
        
        // Damage
        a.onHit(b);
        b.onHit(a);
      }
    }
  }
  
  // Projectile hits
  for (let p of gameState.projectiles) {
    for (let b of gameState.balls) {
      if (p.teamId === b.teamId) continue;
      if (Math.hypot(p.x - b.x, p.y - b.y) < b.size + p.size) {
        b.health -= p.damage;
        p.lifetime = 0;
      }
    }
  }
  
}

function drawGame() {
  // Clear
  ctx.fillStyle = '#f5f5dc';
  ctx.fillRect(0, 0, W, H);
  
  // Draw arena
  let mapSize = Math.min(W, H) - 100;
  let mapX = (W - mapSize) / 2;
  let mapY = (H - mapSize) / 2;
  ctx.fillStyle = '#fff';
  ctx.fillRect(mapX, mapY, mapSize, mapSize);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);
  
  // Draw Battle Royale shrink zone if active
  if (gameMode === 'battleroyale' && gameState.shrinkRadius) {
    ctx.beginPath();
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.arc(W / 2, H / 2, gameState.shrinkRadius, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Draw all entities
  gameState.balls.forEach(b => b.draw(ctx));
  gameState.projectiles.forEach(p => p.draw(ctx));
  gameState.turrets.forEach(t => t.draw(ctx));
  
  // Draw pause indicator
  if (gamePaused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', W / 2, H / 2);
  }
}
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', W / 2, H / 2);
  }
}

// UI FUNCTIONS
function startMode(mode) {
  gameMode = mode;
  gameRunning = true;
  gamePaused = false;
  gameSpeed = 1;
  document.getElementById('mainMenu').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'block';
  document.getElementById('modeLabel').textContent = mode.toUpperCase();
  document.getElementById('pauseBtn').textContent = '⏸️ Pause';
  document.getElementById('speedSlider').value = 1;
  document.getElementById('speedLabel').textContent = '1x';
  
  // Populate ball types
  let select = document.getElementById('ballType');
  select.innerHTML = '';
  for (let key in WEAPONS) {
    select.innerHTML += `<option value="${key}">${WEAPONS[key].name}</option>`;
  }
  for (let key in BLOCK_BREAKERS) {
    select.innerHTML += `<option value="${key}">${BLOCK_BREAKERS[key].name}</option>`;
  }
  
  select.onchange = () => {
    let type = select.value;
    let weapon = WEAPONS[type] || BLOCK_BREAKERS[type];
    document.getElementById('ballDesc').textContent = weapon ? weapon.desc : '';
  };
  select.onchange();
  
  gameLoop();
}

function endGame() {
  gameRunning = false;
  saveGame();
  document.getElementById('gameScreen').style.display = 'none';
  document.getElementById('mainMenu').style.display = 'flex';
  gameState = { balls: [], projectiles: [], turrets: [], teams: {}, nextTeamId: 1, nextBallId: 1, shrinkRadius: null, spawnX: W/2, spawnY: H/2 };
}

function saveGame() {
  let games = JSON.parse(localStorage.getItem('earclacks_games') || '[]');
  games.push({
    date: new Date().toISOString(),
    mode: gameMode,
    balls: gameState.balls.length,
    duration: Date.now()
  });
  localStorage.setItem('earclacks_games', JSON.stringify(games));
}

function showHistory() {
  document.getElementById('mainMenu').style.display = 'none';
  document.getElementById('historyScreen').style.display = 'flex';
  let games = JSON.parse(localStorage.getItem('earclacks_games') || '[]');
  let html = games.map((g, i) => `
    <div class="game-item">
      <div>${new Date(g.date).toLocaleString()} - ${g.mode} (${g.balls} balls)</div>
      <button onclick="deleteGame(${i})">Delete</button>
    </div>
  `).join('');
  document.getElementById('gamesList').innerHTML = html || '<p>No games yet</p>';
}

function deleteGame(idx) {
  let games = JSON.parse(localStorage.getItem('earclacks_games') || '[]');
  games.splice(idx, 1);
  localStorage.setItem('earclacks_games', JSON.stringify(games));
  showHistory();
}

function backToMenu() {
  document.getElementById('historyScreen').style.display = 'none';
  document.getElementById('mainMenu').style.display = 'flex';
}

// Canvas click
canvas.addEventListener('click', (e) => {
  let rect = canvas.getBoundingClientRect();
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;
  
  // Check if clicked on ball
  for (let b of gameState.balls) {
    if (Math.hypot(x - b.x, y - b.y) < b.size) {
      selectedBall = b;
      return;
    }
  }
  
  // Set spawn position
  gameState.spawnX = x;
  gameState.spawnY = y;
});
