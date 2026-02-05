const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;

window.addEventListener('resize', ()=>{W=canvas.width=innerWidth;H=canvas.height=innerHeight});

// Game state controls
let gamePaused = false;
let gameSpeed = 1;

const rand = (a,b)=> Math.random()*(b-a)+a;
const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));

function roundRectPath(ctx, x, y, w, h, r){
  r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const STORAGE_KEY = 'earclacks_games_v1';
const STORAGE_ACTIVE_KEY = 'earclacks_active_game_v1';

class Entity{
  constructor(x,y){this.x=x;this.y=y;this.vx=0;this.vy=0}
  update(){this.x+=this.vx;this.y+=this.vy}
}

class Ball extends Entity{
  constructor(x,y,type='basic'){
    super(x,y);
    this.type = type;
    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.baseSize = 28;
    this.size = 28;
    this.speed = 2.5 + Math.random()*1.5;
    this.damage = 1;
    this.teamId = null; // null = individual (no team)
    this.target = null;
    this.age=0;
    this.color = `hsl(${Math.random()*360}, 65%, 60%)`;
    this.individualColor = this.color;
    this.abilities = {};
    this.blinkTime = 0;
    this.cooldowns = {};
    this.lineageId = null;
    this.generation = 0;
    this.decayFrames = null; // clones can expire
    this.zoneCooldown = 0;
    this.zonePoison = 0;

    if(type==='basic'){this.abilities.tracker=true;this.baseSize=28;this.size=28}
    if(type==='grower'){this.abilities.grow=true;this.baseSize=25;this.size=25}
    if(type==='wrench'){this.abilities.wrench=true;this.baseSize=28;this.size=28}
    if(type==='swinger'){this.abilities.swing=true;this.baseSize=30;this.size=30}
    if(type==='splitter'){this.abilities.split=true;this.baseSize=26;this.size=26}
    if(type==='healer'){this.abilities.heal=true;this.baseSize=24;this.size=24}
    if(type==='speeder'){this.abilities.speed=true;this.baseSize=22;this.size=22;this.speed*=1.8}
    if(type==='tank'){this.abilities.tank=true;this.baseSize=32;this.size=32;this.maxHealth=200;this.health=200;this.speed*=0.75;this.damage*=1.15}
    if(type==='sniper'){this.abilities.sniper=true;this.baseSize=20;this.size=20}
    if(type==='vampire'){this.abilities.vampire=true;this.baseSize=26;this.size=26}
    if(type==='bomber'){this.abilities.bomber=true;this.baseSize=25;this.size=25}
    if(type==='freezer'){this.abilities.freezer=true;this.baseSize=24;this.size=24;this.freezeRadius=80}
    if(type==='shield'){this.abilities.shield=true;this.baseSize=27;this.size=27;this.shieldHealth=50;this.shieldActive=true}
    if(type==='teleporter'){this.abilities.teleporter=true;this.baseSize=23;this.size=23;this.speed*=1.3}
    if(type==='multiplier'){this.abilities.multiplier=true;this.baseSize=22;this.size=22}
    if(type==='drainer'){this.abilities.drainer=true;this.baseSize=26;this.size=26;this.drainRadius=70}
    if(type==='artillery'){this.abilities.artillery=true;this.baseSize=30;this.size=30;this.speed*=0.8}
    if(type==='medic'){this.abilities.medic=true;this.baseSize=24;this.size=24;this.healRadius=90}
    if(type==='rammer'){this.abilities.rammer=true;this.baseSize=30;this.size=30;this.speed*=1.2;this.damage*=1.35}
    if(type==='blinker'){this.abilities.blinker=true;this.baseSize=23;this.size=23;this.blinkCooldown=0}
    if(type==='magnet'){this.abilities.magnet=true;this.baseSize=26;this.size=26;this.magnetRadius=120}
    if(type==='splitshot'){this.abilities.splitshot=true;this.baseSize=22;this.size=22}

    // Start with random straight-line velocity
    let angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;

    this.id = Ball.nextId++;
    if(!this.lineageId) this.lineageId = this.id;
    this.selected = false;
    this.hitCooldown = {};
  }

  isAlive(){return this.health>0}

  takeDamage(d, attacker=null){
    if(this.blinkTime > 0) d *= 0.65;

    if(this.abilities.shield && this.shieldActive && this.shieldHealth > 0){
      const absorbed = Math.min(d, this.shieldHealth);
      this.shieldHealth -= absorbed;
      d -= absorbed;
      if(this.shieldHealth <= 0){
        this.shieldActive = false;
        this.shieldHealth = 0;
      }
    }

    if(d <= 0) return;

    this.health -= d;
    if(this.health < 0) this.health = 0;

    if(attacker && attacker.abilities.vampire && d > 0){
      attacker.health = Math.min(attacker.maxHealth, attacker.health + d * 0.5);
    }
  }

  findTarget(list){
    let best=null; let bd=1e9;
    for(let b of list){
      if(b===this||!b.isAlive()||isSameTeam(this,b)) continue;
      let d2 = (b.x-this.x)*(b.x-this.x)+(b.y-this.y)*(b.y-this.y);
      if(d2<bd){bd=d2;best=b}
    }
    this.target=best;
  }

  applyAbilities(game){
    for(const k in this.cooldowns){
      if(this.cooldowns[k] > 0) this.cooldowns[k]--;
    }

    if(this.abilities.tracker && this.target && this.target.isAlive()){
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const steer = 0.02;
      const nx = dx / dist;
      const ny = dy / dist;
      this.vx = this.vx * (1 - steer) + nx * this.speed * steer;
      this.vy = this.vy * (1 - steer) + ny * this.speed * steer;
      const mag = Math.hypot(this.vx, this.vy) || 1;
      this.vx = (this.vx / mag) * this.speed;
      this.vy = (this.vy / mag) * this.speed;
    }
    if(this.abilities.grow){
      if(this.baseSize < 120) this.baseSize += 0.2;
    }
    if(this.abilities.wrench){
      if(!this.cooldowns.wrench){
        game.spawnTurret(this.x+rand(-20,20),this.y+rand(-20,20),this.teamId,this.color,this.id);
        this.cooldowns.wrench = 60 * 5;
      }
    }
    if(this.abilities.swing){
      if(!this.swingOrb || !this.swingOrb.alive){
        this.swingOrb = {angle: Math.random()*Math.PI*2, r: this.size+20, alive:true};
      }
      this.swingOrb.angle += 0.12;
    }
    if(this.abilities.heal){
      if(this.health < this.maxHealth){
        this.health = Math.min(this.maxHealth, this.health + 0.05);
      }
    }
    if(this.abilities.sniper){
      if(!this.cooldowns.sniper && this.target && this.target.isAlive()){
        let ang = Math.atan2(this.target.y-this.y,this.target.x-this.x);
        game.spawnTypedProjectile(this.id, this.x, this.y, Math.cos(ang)*10, Math.sin(ang)*10, this.teamId, 5 * this.damage, 'sniper');
        this.cooldowns.sniper = 150;
      }
    }
    if(this.abilities.freezer){
      for(let b of game.balls){
        if(b===this||!b.isAlive()||isSameTeam(this,b)) continue;
        let dist = Math.hypot(b.x-this.x,b.y-this.y);
        if(dist < this.freezeRadius){
          b.vx *= 0.98;
          b.vy *= 0.98;
        }
      }
    }
    if(this.abilities.shield){
      if(!this.shieldCooldown) this.shieldCooldown = 0;
      if(this.shieldCooldown > 0) this.shieldCooldown--;
      if(this.shieldHealth < 60 && this.shieldCooldown === 0){
        this.shieldActive = true;
        this.shieldHealth = Math.min(60, this.shieldHealth + 8);
        this.shieldCooldown = 60 * 3;
      }
    }
    if(this.abilities.teleporter){
      if(!this.cooldowns.teleporter){
        let bounds = game.getMapBounds();
        this.x = rand(bounds.minX + 50, bounds.maxX - 50);
        this.y = rand(bounds.minY + 50, bounds.maxY - 50);
        this.cooldowns.teleporter = 60 * 4;
      }
    }
    if(this.abilities.multiplier){
      if(this.generation === 0 && !this.cooldowns.multiplier && game.getLineageCount(this.lineageId) < 5){
        let clone = new Ball(this.x+rand(-30,30),this.y+rand(-30,30),this.type);
        clone.teamId = this.teamId;
        clone.individualColor = clone.color;
        clone.lineageId = this.lineageId;
        clone.generation = this.generation + 1;
        clone.decayFrames = 60 * 45;
        clone.baseSize = this.baseSize * 0.85;
        applyTeamColor(clone);
        game.balls.push(clone);
        this.cooldowns.multiplier = 60 * 6;
      }
    }
    if(this.abilities.split){
      if(this.generation === 0 && !this.cooldowns.split && game.getLineageCount(this.lineageId) < 5){
        let clone = new Ball(this.x+rand(-25,25),this.y+rand(-25,25),this.type);
        clone.teamId = this.teamId;
        clone.individualColor = clone.color;
        clone.lineageId = this.lineageId;
        clone.generation = this.generation + 1;
        clone.decayFrames = 60 * 45;
        clone.baseSize = this.baseSize * 0.8;
        applyTeamColor(clone);
        game.balls.push(clone);
        this.cooldowns.split = 60 * 4;
      }
    }
    if(this.abilities.drainer){
      for(let b of game.balls){
        if(b===this||!b.isAlive()||isSameTeam(this,b)) continue;
        let dist = Math.hypot(b.x-this.x,b.y-this.y);
        if(dist < this.drainRadius){
          b.speed *= 0.999;
          b.damage *= 0.9995;
          let angle = Math.atan2(b.vy, b.vx);
          b.vx = Math.cos(angle) * b.speed;
          b.vy = Math.sin(angle) * b.speed;
        }
      }
    }
    if(this.abilities.artillery){
      if(!this.cooldowns.artillery && this.target && this.target.isAlive()){
        let ang = Math.atan2(this.target.y-this.y,this.target.x-this.x);
        let p = game.spawnTypedProjectile(this.id, this.x, this.y, Math.cos(ang)*5, Math.sin(ang)*5, this.teamId, 3 * this.damage, 'artillery');
        p.splashRadius = 70;
        this.cooldowns.artillery = 140;
      }
    }
    if(this.abilities.medic){
      for(let b of game.balls){
        if(b===this||!b.isAlive()||!isSameTeam(this,b)) continue;
        let dist = Math.hypot(b.x-this.x,b.y-this.y);
        if(dist < this.healRadius){
          b.health = Math.min(b.maxHealth, b.health + 0.08);
        }
      }
    }
    if(this.abilities.blinker){
      if(this.blinkCooldown > 0) this.blinkCooldown--;
      if(this.blinkTime > 0) this.blinkTime--;
      if(this.blinkCooldown === 0){
        this.blinkTime = 30;
        this.blinkCooldown = 180;
        let bounds = game.getMapBounds();
        this.x = rand(bounds.minX + 30, bounds.maxX - 30);
        this.y = rand(bounds.minY + 30, bounds.maxY - 30);
      }
    }
    if(this.abilities.magnet){
      for(let b of game.balls){
        if(b===this||!b.isAlive()||isSameTeam(this,b)) continue;
        let dist = Math.hypot(b.x-this.x,b.y-this.y);
        if(dist < this.magnetRadius){
          let nx = (this.x - b.x) / (dist || 1);
          let ny = (this.y - b.y) / (dist || 1);
          b.vx += nx * 0.03;
          b.vy += ny * 0.03;
        }
      }
    }
    if(this.abilities.splitshot){
      if(!this.cooldowns.splitshot && this.target && this.target.isAlive()){
        let ang = Math.atan2(this.target.y-this.y,this.target.x-this.x);
        for(let i=-1;i<=1;i++){
          let spread = ang + i*0.25;
          game.spawnTypedProjectile(this.id, this.x, this.y, Math.cos(spread)*8, Math.sin(spread)*8, this.teamId, 1 * this.damage, 'splitshot');
        }
        this.cooldowns.splitshot = 110;
      }
    }
  }

  step(game, list){
    if(!this.isAlive()) return;
    this.age++;

    if(this.zoneCooldown > 0) this.zoneCooldown--;
    if(this.zonePoison > 0) this.zonePoison--;

    this.findTarget(list);

    if(this.decayFrames && this.age > this.decayFrames){
      this.health = 0;
      return;
    }

    for(const k in this.hitCooldown){
      if(this.hitCooldown[k] > 0) this.hitCooldown[k]--;
      if(this.hitCooldown[k] <= 0) delete this.hitCooldown[k];
    }

    let healthPercent = this.health / this.maxHealth;
    if(this.abilities.grow){
      this.size = this.baseSize + (1 - healthPercent) * this.baseSize * 2.8;
    } else {
      this.size = this.baseSize * (0.5 + healthPercent * 0.5);
    }

    this.update();

    let mapSize = Math.min(W,H) - 100;
    let mapX = (W-mapSize)/2;
    let mapY = (H-mapSize)/2;
    if(this.x < mapX+this.size){this.x=mapX+this.size;this.vx*=-0.7}
    if(this.y < mapY+this.size){this.y=mapY+this.size;this.vy*=-0.7}
    if(this.x > mapX+mapSize-this.size){this.x=mapX+mapSize-this.size;this.vx*=-0.7}
    if(this.y > mapY+mapSize-this.size){this.y=mapY+mapSize-this.size;this.vy*=-0.7}

    this.applyAbilities(game);

    for(let turret of game.turrets){
      if(!turret.alive) continue;
      if(isFriendlyTurret(this, turret)) continue;
      let dx = this.x - turret.x;
      let dy = this.y - turret.y;
      let dist = Math.hypot(dx,dy);
      let minDist = this.size + turret.size/2;
      if(dist < minDist && dist > 0){
        let overlap = minDist - dist;
        let nx = dx/dist;
        let ny = dy/dist;
        this.x += nx * overlap;
        this.y += ny * overlap;

        let dotProd = this.vx*nx + this.vy*ny;
        this.vx -= 2 * dotProd * nx * 0.9;
        this.vy -= 2 * dotProd * ny * 0.9;

        this.takeDamage(0.1);
      }
    }

    for(let other of list){
      if(other === this || !other.isAlive()) continue;

      let otherId = other.id;
      let dx = other.x - this.x;
      let dy = other.y - this.y;
      let dist = Math.hypot(dx,dy);
      let minDist = this.size + other.size;

      if(dist < minDist && dist > 0){
        let overlap = minDist - dist;
        let nx = dx / dist;
        let ny = dy / dist;

        this.x -= nx * overlap * 0.5;
        this.y -= ny * overlap * 0.5;
        other.x += nx * overlap * 0.5;
        other.y += ny * overlap * 0.5;

        if(!this.hitCooldown[otherId]){
          this.health = Math.max(0, this.health - 3);
          other.health = Math.max(0, other.health - 3);
          if(this.abilities.vampire) this.health = Math.min(this.maxHealth, this.health + 1.5);
          if(other.abilities.vampire) other.health = Math.min(other.maxHealth, other.health + 1.5);
          this.hitCooldown[otherId] = 60;
          if(!other.hitCooldown) other.hitCooldown = {};
          other.hitCooldown[this.id] = 60;

          // bounce away immediately
          const selfMul = 1.0;
          const oppMul = this.abilities.rammer ? 1.6 : 1.0;
          this.vx = -nx * this.speed * selfMul;
          this.vy = -ny * this.speed * selfMul;
          other.vx = nx * other.speed * oppMul;
          other.vy = ny * other.speed * oppMul;

          // extra shove for the ramming side
          if(this.abilities.rammer){
            other.vx += nx * 1.2;
            other.vy += ny * 1.2;
          }
          if(other.abilities.rammer){
            this.vx -= nx * 1.2;
            this.vy -= ny * 1.2;
          }
        }
      }
    }
  }

  draw(ctx){
    if(!this.isAlive()) return;
    ctx.save();
    ctx.translate(this.x,this.y);

    if(this.selected){
      ctx.beginPath();
      ctx.arc(0,0,this.size+4,0,Math.PI*2);
      ctx.strokeStyle = '#fffb8a';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if(this.abilities.shield && this.shieldActive && this.shieldHealth > 0){
      ctx.beginPath();
      ctx.arc(0,0,this.size+6,0,Math.PI*2);
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if(this.blinkTime > 0){
      ctx.globalAlpha = 0.5;
    }

    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(0,0,this.size,0,Math.PI*2);
    ctx.fill();

    // per-type visuals
    const r = this.size;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;

    switch(this.type){
      case 'tank': {
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0,0,0,0.95)';
        ctx.beginPath(); ctx.arc(0,0,r+1,0,Math.PI*2); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.arc(0,0,r*0.65,0,Math.PI*2); ctx.stroke();
        break;
      }
      case 'sniper': {
        ctx.strokeStyle = 'rgba(0,0,0,0.95)';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(r+12,0); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.arc(0,0,r*0.85,0,Math.PI*2); ctx.stroke();
        break;
      }
      case 'artillery': {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(r*0.25,-5,r*0.9,10);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.arc(0,0,r*0.85,0,Math.PI*2); ctx.stroke();
        break;
      }
      case 'wrench': {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        for(let i=0;i<6;i++){
          const a = (i/6)*Math.PI*2;
          const x = Math.cos(a) * (r*0.75);
          const y = Math.sin(a) * (r*0.75);
          ctx.fillRect(x-3,y-3,6,6);
        }
        break;
      }
      case 'swinger': {
        ctx.strokeStyle = 'rgba(253,230,138,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0,0,r+18,0,Math.PI*2); ctx.stroke();
        break;
      }
      case 'grower': {
        ctx.strokeStyle = 'rgba(0,0,0,0.85)';
        ctx.lineWidth = 2;
        for(let i=0;i<10;i++){
          const a = (i/10)*Math.PI*2;
          const x1 = Math.cos(a) * (r*0.9);
          const y1 = Math.sin(a) * (r*0.9);
          const x2 = Math.cos(a) * (r*1.15);
          const y2 = Math.sin(a) * (r*1.15);
          ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        }
        break;
      }
      case 'healer': {
        ctx.strokeStyle = 'rgba(43,213,118,0.95)';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(-8,0); ctx.lineTo(8,0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(0,8); ctx.stroke();
        break;
      }
      case 'medic': {
        ctx.strokeStyle = 'rgba(43,213,118,0.95)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(10,0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(0,10); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.arc(0,0,r*0.85,0,Math.PI*2); ctx.stroke();
        break;
      }
      case 'speeder': {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-r*1.1,-6); ctx.lineTo(-r*0.2,-6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r*1.1,6); ctx.lineTo(-r*0.2,6); ctx.stroke();
        break;
      }
      case 'vampire': {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.moveTo(-8, r*0.2);
        ctx.lineTo(-2, r*0.55);
        ctx.lineTo(4, r*0.2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(8, r*0.2);
        ctx.lineTo(2, r*0.55);
        ctx.lineTo(-4, r*0.2);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'bomber': {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath(); ctx.arc(0,-r*0.65,5,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'rgba(246,201,69,0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0,-r*0.65); ctx.lineTo(8,-r*0.95); ctx.stroke();
        break;
      }
      case 'freezer': {
        ctx.strokeStyle = 'rgba(0,220,255,0.95)';
        ctx.lineWidth = 2;
        for(let i=0;i<3;i++){
          const a = (i/3)*Math.PI;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a)*-r*0.55, Math.sin(a)*-r*0.55);
          ctx.lineTo(Math.cos(a)*r*0.55, Math.sin(a)*r*0.55);
          ctx.stroke();
        }
        break;
      }
      case 'shield': {
        ctx.strokeStyle = 'rgba(0,255,255,0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0,0,r*0.9,0,Math.PI*2); ctx.stroke();
        break;
      }
      case 'teleporter': {
        ctx.strokeStyle = 'rgba(177,121,255,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0,0,r*0.95,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0,0,r*0.6,0,Math.PI*2); ctx.stroke();
        break;
      }
      case 'blinker': {
        ctx.setLineDash([6,6]);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0,0,r*0.95,0,Math.PI*2); ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 'rammer': {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath();
        ctx.moveTo(r*0.9,-10);
        ctx.lineTo(r*1.25,0);
        ctx.lineTo(r*0.9,10);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'magnet': {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0,0,r*0.55,Math.PI*0.2,Math.PI*0.8);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0,0,r*0.55,Math.PI*1.2,Math.PI*1.8);
        ctx.stroke();
        break;
      }
      case 'drainer': {
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for(let a=0;a<Math.PI*2;a+=0.35){
          const rr = (a/(Math.PI*2)) * r*0.9;
          const x = Math.cos(a) * rr;
          const y = Math.sin(a) * rr;
          if(a===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke();
        break;
      }
      case 'splitter':
      case 'multiplier': {
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-r*0.9,0); ctx.lineTo(r*0.9,0); ctx.stroke();
        ctx.beginPath(); ctx.arc(-r*0.35,0,4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(r*0.35,0,4,0,Math.PI*2); ctx.fill();
        break;
      }
      case 'splitshot': {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath(); ctx.arc(r*0.55,-8,4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(r*0.65,0,4,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(r*0.55,8,4,0,Math.PI*2); ctx.fill();
        break;
      }
    }
    ctx.restore();

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const typeFont = clamp(Math.floor(this.size * 0.28), 8, 14);
    const hpFont = clamp(Math.floor(this.size * 0.7), 10, 28);
    ctx.font = `bold ${hpFont}px Arial`;
    ctx.fillText(Math.ceil(this.health), 0, -typeFont * 0.25);
    ctx.font = `bold ${typeFont}px Arial`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(String(this.type).toUpperCase(), 0, typeFont * 0.95);

    ctx.restore();

    if(this.abilities.swing && this.swingOrb && this.swingOrb.alive){
      let ang = this.swingOrb.angle;
      let r = this.swingOrb.r;
      let sx = this.x + Math.cos(ang)*r;
      let sy = this.y + Math.sin(ang)*r;
      ctx.beginPath(); ctx.fillStyle='#fde68a'; ctx.arc(sx,sy,10,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#000'; ctx.lineWidth=2; ctx.stroke();
    }
  }
}Ball.nextId = 1;

class Turret extends Entity{
  constructor(x,y,teamId,color='#c7b2ff',ownerId=0){
    super(x,y);
    this.teamId=teamId;
    this.cool=0;
    this.color=color;
    this.ownerId=ownerId;
    this.alive=true;
    this.size=26;
    this.selected=false;
  }
  step(game){
    if(!this.alive) return;
    this.cool--;
    if(this.cool<0){
      this.cool = 180;
      let target=null; let bd=1e9;
      let bounds = game.getMapBounds();
      for(let b of game.balls){
        if(!b.isAlive()) continue;
        if(b.id === this.ownerId) continue;
        if(isSameTeamId(this.teamId, b.teamId)) continue;
        if(b.x < bounds.minX || b.x > bounds.maxX || b.y < bounds.minY || b.y > bounds.maxY) continue;
        let d2=(b.x-this.x)*(b.x-this.x)+(b.y-this.y)*(b.y-this.y);
        if(d2<bd){bd=d2;target=b}
      }
      if(target){
        let ang = Math.atan2(target.y-this.y,target.x-this.x);
        game.spawnTypedProjectile(this.ownerId, this.x, this.y, Math.cos(ang)*7, Math.sin(ang)*7, this.teamId, 1, 'turret');
      }
    }
  }
  draw(ctx){
    if(this.selected){
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.x-this.size/2-4,this.y-this.size/2-4,this.size+8,this.size+8);
      ctx.strokeStyle = '#fffb8a';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle=this.color;
    ctx.fillRect(this.x-this.size/2,this.y-this.size/2,this.size,this.size);
    ctx.strokeStyle='#000';
    ctx.lineWidth=3;
    ctx.strokeRect(this.x-this.size/2,this.y-this.size/2,this.size,this.size);
    ctx.fillStyle='#fff';
    ctx.font='bold 14px Arial';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(this.ownerId||'?',this.x,this.y);
  }
}

class Projectile extends Entity{
  constructor(x,y,vx,vy,teamId,dmg,ownerId,style={}){
    super(x,y);
    this.vx=vx;this.vy=vy;this.teamId=teamId;
    this.dmg = Math.max(1, dmg || 0);
    this.life=120;
    this.ownerId=ownerId;
    this.splashRadius=0;
    this.radius = style.radius ?? 4;
    this.fill = style.fill ?? '#ffd166';
    this.stroke = style.stroke ?? null;
    this.shape = style.shape ?? 'circle'; // circle | diamond
    this.spin = style.spin ?? 0;
    this._rot = 0;
  }
  step(game){
    this.update();
    this._rot += this.spin;
    this.life--;
    if(this.life<0) this.dead=true;
    if(this.x<0||this.y<0||this.x>W||this.y>H) this.dead=true;
    let bounds = game.getMapBounds();
    if(this.x<bounds.minX||this.x>bounds.maxX||this.y<bounds.minY||this.y>bounds.maxY) this.dead=true;
  }
  draw(ctx){
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this._rot);
    ctx.beginPath();
    if(this.shape === 'diamond'){
      const r = this.radius;
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
    }else{
      ctx.arc(0,0,this.radius,0,Math.PI*2);
    }
    ctx.fillStyle = this.fill;
    ctx.fill();
    if(this.stroke){
      ctx.strokeStyle = this.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }
}

class Game{
  constructor(){
    this.balls=[];
    this.turrets=[];
    this.projectiles=[];
    this.spawnPos={x:W/2,y:H/2};
    this.mode = 'sandbox'; // sandbox | battle_royale
    this.paused = false;
    this.pauseReason = '';
    this.winnerBallId = null;
  }

  setMode(mode){
    if(mode === 'tanks') mode = 'sandbox';
    this.mode = (mode === 'battle_royale') ? 'battle_royale' : 'sandbox';
    this.paused = false;
    this.pauseReason = '';
    this.winnerBallId = null;
  }

  getMapBounds(){
    let mapSize = Math.min(W,H) - 100;
    let mapX = (W-mapSize)/2;
    let mapY = (H-mapSize)/2;
    return {minX: mapX, minY: mapY, maxX: mapX+mapSize, maxY: mapY+mapSize, size: mapSize};
  }

  clampToMap(x,y,padding=20){
    let bounds = this.getMapBounds();
    x = Math.max(bounds.minX + padding, Math.min(bounds.maxX - padding, x));
    y = Math.max(bounds.minY + padding, Math.min(bounds.maxY - padding, y));
    return {x,y};
  }

  randomSpawnPoint(padding=25){
    const bounds = this.getMapBounds();
    return {
      x: rand(bounds.minX + padding, bounds.maxX - padding),
      y: rand(bounds.minY + padding, bounds.maxY - padding)
    };
  }

  getLineageCount(lineageId){
    let n = 0;
    for(const b of this.balls){
      if(!b.isAlive()) continue;
      if(b.lineageId === lineageId) n++;
    }
    return n;
  }

  spawnBall(x,y,type){
    let b=new Ball(x,y,type);
    this.balls.push(b);
    this.maybeUnpauseAfterSpawn();
    return b;
  }

  aliveBallCount(){
    let n = 0;
    for(const b of this.balls) if(b.isAlive()) n++;
    return n;
  }

  maybeUnpauseAfterSpawn(){
    if(this.mode !== 'battle_royale') return;
    if(!this.paused) return;
    if(this.pauseReason !== 'winner') return;
    if(this.aliveBallCount() > 1){
      this.paused = false;
      this.pauseReason = '';
      this.winnerBallId = null;
    }
  }

  spawnTurret(x,y,teamId,color,ownerId){
    let pos = this.clampToMap(x,y,20);
    const turretColor = (teamId && teams?.[teamId]?.color) ? teams[teamId].color : color;
    let t=new Turret(pos.x,pos.y,teamId,turretColor,ownerId);
    this.turrets.push(t);
  }

  spawnProjectile(p){this.projectiles.push(p)}

  projectileStyle(ownerBall, kind){
    const t = ownerBall?.type || 'basic';
    const base = {radius: 4, fill: '#ffd166', stroke: 'rgba(0,0,0,0.7)', shape: 'circle', spin: 0.12};

    if(kind === 'turret'){
      return {...base, radius: 3.2, fill: '#ff9f1c', spin: 0.18};
    }

    if(t === 'sniper'){
      return {...base, radius: 7, fill: '#f8fafc', stroke: 'rgba(0,0,0,0.85)', shape: 'diamond', spin: 0.22};
    }
    if(t === 'artillery'){
      return {...base, radius: 6, fill: '#a78bfa', stroke: 'rgba(0,0,0,0.85)', spin: 0.08};
    }
    if(t === 'splitshot'){
      return {...base, radius: 4.5, fill: '#60a5fa', stroke: 'rgba(0,0,0,0.85)', spin: 0.2};
    }
    if(t === 'freezer'){
      return {...base, radius: 4.8, fill: '#67e8f9', stroke: 'rgba(0,0,0,0.85)', spin: 0.16};
    }
    if(t === 'vampire'){
      return {...base, radius: 4.6, fill: '#fb7185', stroke: 'rgba(0,0,0,0.85)', shape: 'diamond', spin: 0.2};
    }
    if(t === 'medic' || t === 'healer'){
      return {...base, radius: 4.4, fill: '#34d399', stroke: 'rgba(0,0,0,0.85)', spin: 0.18};
    }
    return base;
  }

  spawnTypedProjectile(ownerId, x, y, vx, vy, teamId, dmg, kind){
    const owner = ownerId ? this.balls.find(b => b.id === ownerId) : null;
    const style = this.projectileStyle(owner, kind);
    const p = new Projectile(x, y, vx, vy, teamId, dmg, ownerId, style);
    this.projectiles.push(p);
    return p;
  }

  step(){
    if(this.paused) return;
    for(let t of this.turrets) t.step(this);
    for(let p of this.projectiles) p.step(this);
    for(let p of this.projectiles){
      for(let b of this.balls){
        if(!b.isAlive()) continue;
        if(p.ownerId && b.id === p.ownerId) continue;
        if(isSameTeamId(p.teamId, b.teamId)) continue;
        let d=Math.hypot(p.x-b.x,p.y-b.y);
        if(d < b.size+4){
          const attacker = p.ownerId ? this.balls.find(o => o.id === p.ownerId) : null;
          b.takeDamage(p.dmg, attacker);
          if(p.splashRadius && p.splashRadius > 0){
            for(let o of this.balls){
              if(!o.isAlive() || isSameTeamId(p.teamId, o.teamId)) continue;
              let dist = Math.hypot(o.x-p.x, o.y-p.y);
              if(dist < p.splashRadius){
                o.takeDamage(p.dmg * (1 - dist / p.splashRadius), attacker);
              }
            }
          }
          p.dead=true;
        }
      }
    }
    this.projectiles = this.projectiles.filter(p=>!p.dead);

    for(let b of this.balls){
      if(b.abilities.swing && b.swingOrb && b.swingOrb.alive){
        let sx = b.x+Math.cos(b.swingOrb.angle)*b.swingOrb.r; let sy = b.y+Math.sin(b.swingOrb.angle)*b.swingOrb.r;
        for(let o of this.balls){
          if(o===b||!o.isAlive()||isSameTeam(b,o)) continue;
          let d=Math.hypot(sx-o.x,sy-o.y);
          if(d<12){ o.takeDamage(0.08 * b.damage, b); }
        }
      }
    }

    for(let b of this.balls) b.step(this,this.balls);

    if(this.mode === 'battle_royale'){
      const bounds = this.getMapBounds();
      const cx = (bounds.minX + bounds.maxX) / 2;
      const cy = (bounds.minY + bounds.maxY) / 2;
      const radius = bounds.size * 0.42;
      const poisonInner = radius - 26;
      for(const b of this.balls){
        if(!b.isAlive()) continue;
        const d = Math.hypot(b.x - cx, b.y - cy);
        const inPoison = d > poisonInner && d <= radius;
        const out = d > radius;
        if(out){
          b.zonePoison = 60;
          if(b.zoneCooldown === 0){
            b.health = Math.max(0, b.health - 1);
            b.zoneCooldown = 60;
          }
        }else if(inPoison || b.zonePoison > 0){
          if(b.zoneCooldown === 0){
            b.health = Math.max(0, b.health - 1);
            b.zoneCooldown = 60;
          }
        }
      }
    }

    let deadBalls = this.balls.filter(b=>!b.isAlive());
    for(let dead of deadBalls){
      if(dead.abilities.bomber){
        let explosionRadius = 120;
        for(let b of this.balls){
          if(!b.isAlive() || isSameTeam(dead,b)) continue;
          let dist = Math.hypot(b.x - dead.x, b.y - dead.y);
          if(dist < explosionRadius){
            let damage = (10 * dead.damage) * (1 - dist / explosionRadius);
            b.takeDamage(damage);
          }
        }
      }
    }

    // Get IDs of dead balls before filtering
    const deadBallIds = deadBalls.map(b => b.id);
    
    // Remove dead balls
    this.balls = this.balls.filter(b=>b.isAlive());
    
    // Remove turrets owned by dead balls AND turrets that are dead
    this.turrets = this.turrets.filter(t => t.alive !== false && !deadBallIds.includes(t.ownerId));
    
    // Remove projectiles owned by dead balls
    this.projectiles = this.projectiles.filter(p => !deadBallIds.includes(p.ownerId));

    if(this.mode === 'battle_royale'){
      const alive = this.balls.filter(b => b.isAlive());
      if(alive.length === 1){
        this.paused = true;
        this.pauseReason = 'winner';
        this.winnerBallId = alive[0].id;
      }else if(alive.length === 0){
        this.paused = false;
        this.pauseReason = '';
        this.winnerBallId = null;
      }
    }
  }
  draw(ctx){
    ctx.fillStyle = '#f5f5dc';
    ctx.fillRect(0,0,W,H);

    let mapSize = Math.min(W,H) - 100;
    let mapX = (W-mapSize)/2;
    let mapY = (H-mapSize)/2;
    ctx.fillStyle = '#fff';
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeStyle='#000';
    ctx.lineWidth=4;
    ctx.strokeRect(mapX,mapY,mapSize,mapSize);

    for(let t of this.turrets) t.draw(ctx);
    for(let p of this.projectiles) p.draw(ctx);
    for(let b of this.balls) b.draw(ctx);

    if(this.mode === 'battle_royale' && this.paused && this.pauseReason === 'winner' && this.winnerBallId){
      const winner = this.balls.find(b => b.id === this.winnerBallId) || null;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle = 'rgba(13,19,29,0.92)';
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      const bw = Math.min(520, W - 40);
      const bh = 140;
      const bx = (W - bw)/2;
      const by = (H - bh)/2;
      roundRectPath(ctx, bx, by, bw, bh, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#eaf2ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 26px Space Grotesk, Arial';
      ctx.fillText('FIRST PLACE', W/2, by + 46);
      ctx.font = '700 16px IBM Plex Mono, monospace';
      const line = winner ? `#${winner.id} ${String(winner.type).toUpperCase()}` : `#${this.winnerBallId}`;
      ctx.fillText(line, W/2, by + 82);
      ctx.font = '500 12px Space Grotesk, Arial';
      ctx.fillStyle = 'rgba(234,242,255,0.75)';
      ctx.fillText('Spawn another tank to continue', W/2, by + 110);
      ctx.restore();
    }
  }
}

const game = new Game();
let selectedBallForEdit = null;
let selectedTurretForInspect = null;

const tankDescriptions = {
  basic: 'Tracks the nearest enemy and gently steers toward it for consistent pressure',
  grower: 'Grows larger as health decreases gaining size and presence',
  wrench: 'Places a defensive turret every 5 seconds to control territory',
  swinger: 'Swings damaging orb around body dealing area damage continuously',
  splitter: 'Creates living copies over time (up to 5 total) to multiply threats',
  healer: 'Regenerates health slowly over time with strong survivability',
  speeder: 'Moves 80% faster than normal great for hit and run',
  tank: 'Double health and larger size, but slower movement speed and heavier impacts',
  sniper: 'Fires long range projectiles attacking from safe distance',
  vampire: 'Steals health from damaged enemies growing stronger per hit',
  bomber: 'Explodes on death dealing massive area damage to nearby enemies',
  freezer: 'Slows down all nearby enemies reducing their speed dramatically',
  shield: 'Protected by regenerating shield that blocks incoming damage completely',
  teleporter: 'Randomly teleports short distances avoiding attacks and repositioning',
  multiplier: 'Creates living clones over time (up to 5 total) to overwhelm enemies',
  drainer: 'Drains speed and damage from nearby enemies weakening them permanently',
  artillery: 'Launches slow explosive shells that damage groups from long range',
  medic: 'Heals nearby allies over time keeping the team alive longer',
  rammer: 'Hits with brutal knockback dealing heavy collision damage on impact',
  blinker: 'Teleports and becomes briefly invulnerable to avoid incoming damage',
  magnet: 'Pulls enemies inward disrupting movement and clustering targets',
  splitshot: 'Fires a spread of projectiles to cover wide attack angles'
};

let teams = {};
let nextTeamId = 1;

let games = [];
let activeGameId = null;

function isSameTeam(a,b){
  return a.teamId && b.teamId && a.teamId === b.teamId;
}
function isSameTeamId(aTeamId, bTeamId){
  return aTeamId && bTeamId && aTeamId === bTeamId;
}
function isFriendlyTurret(ball, turret){
  if(turret.ownerId && ball.id === turret.ownerId) return true;
  return isSameTeamId(ball.teamId, turret.teamId);
}

function applyTeamColor(ball){
  if(!ball) return;
  if(!ball.individualColor) ball.individualColor = ball.color;
  if(ball.teamId && teams[ball.teamId]){
    ball.color = teams[ball.teamId].color;
  } else {
    ball.color = ball.individualColor;
  }
}

function createTeam(name){
  const id = `team_${nextTeamId++}`;
  const color = `hsl(${Math.random()*360}, 70%, 55%)`;
  teams[id] = {id, name, color};
  return id;
}

function buildTeamOptions(selectedId){
  let html = `<option value="">Individual (No Team)</option>`;
  Object.values(teams).forEach(team => {
    const selected = team.id === selectedId ? 'selected' : '';
    html += `<option value="${team.id}" ${selected}>${team.name}</option>`;
  });
  return html;
}

function refreshTeamSelects(){
  const spawnSelect = document.getElementById('spawnTeamSelect');
  const statSelect = document.getElementById('stat-teamSelect');
  spawnSelect.innerHTML = buildTeamOptions(spawnSelect.value || '');
  statSelect.innerHTML = buildTeamOptions(statSelect.value || '');
}

function updateTeamsList(){
  const list = document.getElementById('teamsList');
  list.innerHTML = '';
  const teamArr = Object.values(teams);
  if(teamArr.length === 0){
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No teams yet. Create one to group tanks.';
    list.appendChild(empty);
    return;
  }
  teamArr.forEach(team => {
    const item = document.createElement('div');
    item.className = 'team-card';
    const count = game.balls.filter(b => b.teamId === team.id).length;
    item.innerHTML = `
      <div class="team-swatch" style="background:${team.color}"></div>
      <div class="team-info">
        <div class="team-name">${team.name}</div>
        <div class="team-meta">${count} tanks</div>
      </div>
    `;
    list.appendChild(item);
  });
}

function updateSidebar(){
  const list = document.getElementById('ballList');
  list.innerHTML = '';
  game.balls.forEach(b => {
    const item = document.createElement('div');
    item.className = 'ball-item' + (b.selected ? ' selected' : '');

    const teamSelect = document.createElement('select');
    teamSelect.className = 'team-select';
    teamSelect.innerHTML = buildTeamOptions(b.teamId || '');
    teamSelect.addEventListener('change', (e) => {
      e.stopPropagation();
      b.teamId = e.target.value || null;
      applyTeamColor(b);
      updateTeamsList();
      markDirty();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-tiny';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteBall(b);
    });

    item.innerHTML = `
      <div style="background:${b.color}" class="ball-color"></div>
      <div class="ball-meta">
        <div class="ball-title">#${b.id} ${b.type}</div>
        <div class="ball-sub">HP ${Math.ceil(b.health)} · ${b.teamId ? (teams[b.teamId]?.name || 'Team') : 'Individual'}</div>
      </div>
    `;
    item.appendChild(teamSelect);
    item.appendChild(deleteBtn);

    item.addEventListener('click', () => {
      if(b.selected){
        selectBall(null);
      }else{
        selectBall(b);
      }
      selectTurret(null);
      updateSidebar();
      markDirty();
    });

    list.appendChild(item);
  });

  if(selectedBallForEdit && selectedBallForEdit.isAlive()){
    document.getElementById('statEditor').style.display = 'block';
    document.getElementById('selectedBallId').textContent = selectedBallForEdit.id;
    if(document.activeElement.id !== 'stat-health') 
      document.getElementById('stat-health').value = selectedBallForEdit.health.toFixed(1);
    if(document.activeElement.id !== 'stat-maxHealth') 
      document.getElementById('stat-maxHealth').value = selectedBallForEdit.maxHealth;
    if(document.activeElement.id !== 'stat-baseSize') 
      document.getElementById('stat-baseSize').value = selectedBallForEdit.baseSize.toFixed(1);
    if(document.activeElement.id !== 'stat-speed') 
      document.getElementById('stat-speed').value = selectedBallForEdit.speed.toFixed(2);
    if(document.activeElement.id !== 'stat-damage') 
      document.getElementById('stat-damage').value = selectedBallForEdit.damage.toFixed(2);
    const statTeam = document.getElementById('stat-teamSelect');
    // Only update if the value changed (to prevent flickering)
    if(statTeam.value !== (selectedBallForEdit.teamId || '')){
      statTeam.innerHTML = buildTeamOptions(selectedBallForEdit.teamId || '');
    }
    syncStatBars();
  } else {
    document.getElementById('statEditor').style.display = 'none';
    selectedBallForEdit = null;
  }

  const turretBox = document.getElementById('turretInspector');
  if(turretBox){
    if(selectedTurretForInspect && selectedTurretForInspect.alive){
      turretBox.style.display = 'block';
      const ownerBall = game.balls.find(b => b.id === selectedTurretForInspect.ownerId) || null;
      document.getElementById('turretOwnerId').textContent = ownerBall ? `#${ownerBall.id} (${ownerBall.type})` : `#${selectedTurretForInspect.ownerId || '?'}`;
      document.getElementById('turretTeam').textContent = selectedTurretForInspect.teamId ? (teams[selectedTurretForInspect.teamId]?.name || 'Team') : 'Individual';
      const jumpBtn = document.getElementById('jumpToOwner');
      if(jumpBtn){
        jumpBtn.disabled = !ownerBall;
        jumpBtn.onclick = () => {
          if(ownerBall){
            selectBall(ownerBall);
            updateSidebar();
            markDirty();
          }
        };
      }
    } else {
      turretBox.style.display = 'none';
    }
  }
}

function deleteBall(ball){
  // Remove the ball's turrets
  game.turrets = game.turrets.filter(t => t.ownerId !== ball.id);
  // Remove the ball's projectiles
  game.projectiles = game.projectiles.filter(p => p.ownerId !== ball.id);
  // Remove the ball itself
  game.balls = game.balls.filter(b => b.id !== ball.id);
  // Deselect if this was the selected ball
  if(selectedBallForEdit && selectedBallForEdit.id === ball.id){
    selectedBallForEdit = null;
  }
  markDirty();
}

function selectBall(target){
  game.balls.forEach(b => { b.selected = b === target; });
  selectedBallForEdit = target || null;
}

function selectTurret(target){
  game.turrets.forEach(t => { t.selected = t === target; });
  selectedTurretForInspect = target || null;
}

function markDirty(){
  uiDirty = true;
  saveActiveGameState();
}

function validateSpawnForm(){
  const qty = parseInt(document.getElementById('spawnQty').value, 10) || 0;
  const isValid = qty > 0 && qty <= 50;
  document.getElementById('confirmSpawn').disabled = !isValid;
}

const STAT_SEGMENTS = 10;
const STAT_BAR_CONFIG = {
  health: {
    min: 0,
    max: (b) => b.maxHealth,
    parse: (raw) => parseFloat(raw),
    set: (b, v) => { b.health = clamp(v, 0, b.maxHealth); }
  },
  maxHealth: {
    min: 20,
    max: () => 300,
    parse: (raw) => parseFloat(raw),
    set: (b, v) => {
      b.maxHealth = clamp(v, 20, 300);
      if(b.health > b.maxHealth) b.health = b.maxHealth;
    }
  },
  baseSize: {
    min: 14,
    max: () => 60,
    parse: (raw) => parseFloat(raw),
    set: (b, v) => { b.baseSize = clamp(v, 14, 60); }
  },
  speed: {
    min: 0.5,
    max: () => 7,
    parse: (raw) => parseFloat(raw),
    set: (b, v) => {
      b.speed = clamp(v, 0.5, 7);
      let angle = Math.atan2(b.vy, b.vx);
      b.vx = Math.cos(angle) * b.speed;
      b.vy = Math.sin(angle) * b.speed;
    }
  },
  damage: {
    min: 0.2,
    max: () => 4,
    parse: (raw) => parseFloat(raw),
    set: (b, v) => { b.damage = clamp(v, 0.2, 4); }
  }
};

function statRatio(ball, stat){
  const cfg = STAT_BAR_CONFIG[stat];
  if(!cfg) return 0;
  if(stat === 'health'){
    const max = cfg.max(ball) || 1;
    return clamp(ball.health / max, 0, 1);
  }
  const min = cfg.min;
  const max = cfg.max(ball);
  const cur = ball[stat];
  return clamp((cur - min) / (max - min || 1), 0, 1);
}

function statValueFromRatio(ball, stat, ratio){
  const cfg = STAT_BAR_CONFIG[stat];
  if(!cfg) return 0;
  ratio = clamp(ratio, 0, 1);
  if(stat === 'health'){
    return (cfg.max(ball) || 0) * ratio;
  }
  const min = cfg.min;
  const max = cfg.max(ball);
  return min + (max - min) * ratio;
}

function setBallStat(ball, stat, rawValue){
  const cfg = STAT_BAR_CONFIG[stat];
  if(!cfg) return;
  const v = cfg.parse(rawValue);
  if(Number.isFinite(v)) cfg.set(ball, v);
}

function buildStatBars(){
  document.querySelectorAll('.diep-bar').forEach(bar => {
    const stat = bar.getAttribute('data-bar-for');
    bar.innerHTML = '';
    for(let i=1;i<=STAT_SEGMENTS;i++){
      const seg = document.createElement('div');
      seg.className = 'diep-seg';
      seg.dataset.value = String(i);
      seg.addEventListener('click', () => {
        if(!selectedBallForEdit || !selectedBallForEdit.isAlive()) return;
        const ratio = i / STAT_SEGMENTS;
        const val = statValueFromRatio(selectedBallForEdit, stat, ratio);
        setBallStat(selectedBallForEdit, stat, val);
        markDirty();
        updateSidebar();
      });
      bar.appendChild(seg);
    }
  });
}

function syncStatBars(){
  if(!selectedBallForEdit || !selectedBallForEdit.isAlive()){
    document.querySelectorAll('.diep-seg').forEach(seg => seg.classList.remove('filled'));
    return;
  }
  document.querySelectorAll('.diep-bar').forEach(bar => {
    const stat = bar.getAttribute('data-bar-for');
    const ratio = statRatio(selectedBallForEdit, stat);
    const filled = Math.round(ratio * STAT_SEGMENTS);
    Array.from(bar.children).forEach((seg, idx) => {
      if(idx < filled) seg.classList.add('filled');
      else seg.classList.remove('filled');
    });
  });
}

function serializeGame(){
  return {
    balls: game.balls.map(b => ({
      x:b.x,y:b.y,vx:b.vx,vy:b.vy,type:b.type,health:b.health,maxHealth:b.maxHealth,
      baseSize:b.baseSize,size:b.size,speed:b.speed,damage:b.damage,teamId:b.teamId,
      color:b.color,individualColor:b.individualColor,age:b.age,blinkTime:b.blinkTime
    })),
    turrets: game.turrets.map(t => ({x:t.x,y:t.y,teamId:t.teamId,color:t.color,ownerId:t.ownerId,alive:t.alive,size:t.size})),
    projectiles: game.projectiles.map(p => ({x:p.x,y:p.y,vx:p.vx,vy:p.vy,teamId:p.teamId,dmg:p.dmg,life:p.life,ownerId:p.ownerId,splashRadius:p.splashRadius})),
    spawnPos: {...game.spawnPos},
    mode: game.mode,
    teams,
    nextTeamId
  };
}

function loadGameState(state){
  game.balls = [];
  game.turrets = [];
  game.projectiles = [];
  teams = state.teams || {};
  nextTeamId = state.nextTeamId || 1;
  game.setMode(state.mode || 'sandbox');
  updateModeLabel();

  state.balls.forEach(data => {
    const b = new Ball(data.x,data.y,data.type);
    b.vx = data.vx; b.vy = data.vy;
    b.health = data.health; b.maxHealth = data.maxHealth;
    b.baseSize = data.baseSize; b.size = data.size;
    b.speed = data.speed; b.damage = data.damage;
    b.teamId = data.teamId || null;
    b.color = data.color;
    b.individualColor = data.individualColor || data.color;
    b.age = data.age || 0;
    b.blinkTime = data.blinkTime || 0;
    applyTeamColor(b);
    game.balls.push(b);
  });

  state.turrets.forEach(data => {
    const t = new Turret(data.x,data.y,data.teamId,data.color,data.ownerId);
    t.alive = data.alive;
    t.size = 26;
    game.turrets.push(t);
  });

  state.projectiles.forEach(data => {
    const p = new Projectile(data.x,data.y,data.vx,data.vy,data.teamId,data.dmg,data.ownerId);
    p.life = data.life; p.splashRadius = data.splashRadius || 0;
    game.projectiles.push(p);
  });

  game.spawnPos = state.spawnPos || {x:W/2,y:H/2};
  refreshTeamSelects();
  updateTeamsList();
  markDirty();
}

function loadGamesFromStorage(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch{
    return [];
  }
}

function saveGamesToStorage(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  if(activeGameId) localStorage.setItem(STORAGE_ACTIVE_KEY, activeGameId);
}

function saveActiveGameState(){
  if(!activeGameId) return;
  const gameEntry = games.find(g => g.id === activeGameId);
  if(!gameEntry) return;
  gameEntry.state = serializeGame();
  saveGamesToStorage();
}

function createNewGame(name, mode){
  const id = `game_${Date.now()}_${Math.floor(Math.random()*10000)}`;
  game.setMode(mode || 'sandbox');
  const entry = {id, name, mode: game.mode, createdAt: Date.now(), endedAt: null, state: serializeGame()};
  games.unshift(entry);
  activeGameId = id;
  saveGamesToStorage();
  updateCurrentGameName();
  updateModeLabel();
  return id;
}

function resetGameState(){
  game.balls = [];
  game.turrets = [];
  game.projectiles = [];
  game.spawnPos = {x:W/2,y:H/2};
  selectedBallForEdit = null;
  selectedTurretForInspect = null;
  teams = {};
  nextTeamId = 1;
}

function updateCurrentGameName(){
  const el = document.getElementById('currentGameName');
  const entry = games.find(g => g.id === activeGameId);
  el.textContent = entry ? entry.name : 'New Game';
}

function updateModeLabel(){
  const el = document.getElementById('modeLabel');
  if(!el) return;
  el.textContent = String(game.mode || 'sandbox').toUpperCase();
}

let uiDirty = true;
let uiTick = 0;

function loop(){
  // Run game updates based on speed (only if not paused)
  if(!gamePaused){
    for(let i = 0; i < gameSpeed; i++){
      game.step();
    }
  }
  
  // Always draw, even when paused
  game.draw(ctx);
  
  // Draw pause indicator
  if(gamePaused){
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.font = 'bold 64px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 4;
    ctx.strokeText('⏸ PAUSED', W / 2, H / 2);
    ctx.fillText('⏸ PAUSED', W / 2, H / 2);
  }
  
  document.getElementById('count').innerText = game.balls.length;
  if(uiDirty || uiTick++ % 10 === 0){
    updateSidebar();
    updateTeamsList();
    uiDirty = false;
  }
  requestAnimationFrame(loop)
}

function init(){
  games = loadGamesFromStorage();
  activeGameId = localStorage.getItem(STORAGE_ACTIVE_KEY);
  if(!activeGameId || !games.find(g => g.id === activeGameId)){
    resetGameState();
    createNewGame('New Game', 'sandbox');
  }else{
    const entry = games.find(g => g.id === activeGameId);
    if(entry && entry.state){
      loadGameState(entry.state);
    }else if(entry){
      resetGameState();
      game.setMode(entry.mode || 'sandbox');
      entry.state = serializeGame();
      saveGamesToStorage();
    }
  }
  refreshTeamSelects();
  updateTeamsList();
  updateCurrentGameName();
  updateModeLabel();
  updateSidebar();
  loop();
}

// UI
const spawnType = document.getElementById('type');
spawnType.addEventListener('change', () => {
  document.getElementById('tankDescription').textContent = tankDescriptions[spawnType.value] || '';
  validateSpawnForm();
});
document.getElementById('tankDescription').textContent = tankDescriptions[spawnType.value] || '';

document.getElementById('spawnQty').addEventListener('input', validateSpawnForm);

const confirmSpawn = document.getElementById('confirmSpawn');
confirmSpawn.addEventListener('click', ()=>{
  const qty = clamp(parseInt(document.getElementById('spawnQty').value,10) || 1, 1, 50);
  const teamId = document.getElementById('spawnTeamSelect').value || null;
  const type = spawnType.value;
  for(let i=0;i<qty;i++){
    const pos = game.randomSpawnPoint(35);
    game.spawnPos = {x: pos.x, y: pos.y};
    let b = game.spawnBall(pos.x,pos.y,type);
    b.teamId = teamId;
    applyTeamColor(b);
  }
  selectTurret(null);
  markDirty();
});

const createTeamBtn = document.getElementById('createTeam');
createTeamBtn.addEventListener('click', () => {
  const input = document.getElementById('newTeamName');
  const name = input.value.trim();
  if(!name) return;
  createTeam(name);
  input.value = '';
  refreshTeamSelects();
  updateTeamsList();
  updateSidebar();
  markDirty();
});

canvas.addEventListener('click', (e)=>{
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  let clickedBall = null;
  for(let b of game.balls){
    if(!b.isAlive()) continue;
    let dist = Math.hypot(clickX - b.x, clickY - b.y);
    if(dist < b.size){
      clickedBall = b;
      break;
    }
  }
  if(clickedBall){
    selectBall(clickedBall);
    selectTurret(null);
    markDirty();
    return;
  }

  let clickedTurret = null;
  for(let t of game.turrets){
    if(!t.alive) continue;
    const half = t.size/2;
    if(clickX >= t.x-half && clickX <= t.x+half && clickY >= t.y-half && clickY <= t.y+half){
      clickedTurret = t;
      break;
    }
  }
  if(clickedTurret){
    selectTurret(clickedTurret);
    const ownerBall = game.balls.find(b => b.id === clickedTurret.ownerId) || null;
    selectBall(ownerBall);
    markDirty();
    return;
  }
});

document.getElementById('deleteBall').addEventListener('click', () => {
  if(selectedBallForEdit) deleteBall(selectedBallForEdit);
});

document.getElementById('stat-health').addEventListener('input', (e) => {
  if(selectedBallForEdit){
    setBallStat(selectedBallForEdit, 'health', e.target.value);
    syncStatBars();
    markDirty();
  }
});
document.getElementById('stat-maxHealth').addEventListener('input', (e) => {
  if(selectedBallForEdit){
    setBallStat(selectedBallForEdit, 'maxHealth', e.target.value);
    syncStatBars();
    markDirty();
  }
});
document.getElementById('stat-baseSize').addEventListener('input', (e) => {
  if(selectedBallForEdit){
    setBallStat(selectedBallForEdit, 'baseSize', e.target.value);
    syncStatBars();
    markDirty();
  }
});
document.getElementById('stat-speed').addEventListener('input', (e) => {
  if(selectedBallForEdit){
    setBallStat(selectedBallForEdit, 'speed', e.target.value);
    syncStatBars();
    markDirty();
  }
});
document.getElementById('stat-damage').addEventListener('input', (e) => {
  if(selectedBallForEdit){
    setBallStat(selectedBallForEdit, 'damage', e.target.value);
    syncStatBars();
    markDirty();
  }
});
document.getElementById('stat-teamSelect').addEventListener('change', (e) => {
  if(selectedBallForEdit){
    e.stopPropagation();
    selectedBallForEdit.teamId = e.target.value || null;
    applyTeamColor(selectedBallForEdit);
    updateTeamsList();
    markDirty();
  }
});

document.getElementById('clearMap').addEventListener('click', () => {
  game.balls = [];
  game.turrets = [];
  game.projectiles = [];
  selectedBallForEdit = null;
  selectedTurretForInspect = null;
  markDirty();
});

document.getElementById('clearTanks').addEventListener('click', () => {
  game.balls = [];
  selectedBallForEdit = null;
  selectedTurretForInspect = null;
  markDirty();
});

document.getElementById('historyBtn').addEventListener('click', () => {
  saveActiveGameState();
  window.open('index.html', '_blank', 'noopener');
});

function openModeModal(){
  const modal = document.getElementById('modeModal');
  if(modal) modal.classList.add('open');
}
function closeModeModal(){
  const modal = document.getElementById('modeModal');
  if(modal) modal.classList.remove('open');
}

const newGameBtn = document.getElementById('newGame');
if(newGameBtn) newGameBtn.addEventListener('click', openModeModal);
const closeModeBtn = document.getElementById('closeMode');
if(closeModeBtn) closeModeBtn.addEventListener('click', closeModeModal);
const modeModal = document.getElementById('modeModal');
if(modeModal){
  modeModal.addEventListener('click', (e) => {
    if(e.target.classList.contains('modal-overlay')) closeModeModal();
  });
  modeModal.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      saveActiveGameState();
      resetGameState();
      createNewGame(`Game ${games.length + 1}`, mode);
      refreshTeamSelects();
      updateTeamsList();
      updateModeLabel();
      updateSidebar();
      closeModeModal();
    });
  });
}

document.getElementById('cross').addEventListener('click', ()=>{
  if(game.balls.length<2) return;
  let a = game.balls[Math.floor(Math.random()*game.balls.length)];
  let b = game.balls[Math.floor(Math.random()*game.balls.length)];
  if(a===b) return;
  let h = new Ball((a.x+b.x)/2,(a.y+b.y)/2,'basic');
  h.abilities = {...a.abilities,...b.abilities};
  h.size = Math.max(18, (a.size+b.size)/2);
  h.speed = (a.speed+b.speed)/2;
  h.damage = (a.damage+b.damage)/2;
  h.teamId = null;
  game.balls.push(h);
  markDirty();
});

document.getElementById('restart').addEventListener('click', ()=>{ location.reload() });

// Pause button
const pauseBtn = document.getElementById('pauseBtn');
if(pauseBtn){
  pauseBtn.addEventListener('click', () => {
    gamePaused = !gamePaused;
    pauseBtn.textContent = gamePaused ? '▶️ Resume' : '⏸️ Pause';
  });
}

// Speed slider
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
if(speedSlider && speedValue){
  speedSlider.addEventListener('input', (e) => {
    gameSpeed = parseInt(e.target.value);
    speedValue.textContent = gameSpeed + 'x';
  });
}

buildStatBars();
validateSpawnForm();
init();

// Note: This project is inspired-by Earclacks mechanics (grower, turret spawner, swinger) but is an original implementation.
