const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = canvas.width = innerWidth;
let H = canvas.height = innerHeight;

window.addEventListener('resize', ()=>{W=canvas.width=innerWidth;H=canvas.height=innerHeight});

const rand = (a,b)=> Math.random()*(b-a)+a;

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
    this.baseSize = 28; // Store original size
    this.size = 28; // Bigger (was 20)
    this.speed = 2.5 + Math.random()*1.5;
    this.damage = 2; // Much lower base damage
    this.team = Math.random()*10000; // Each ball unique team (FFA)
    this.target = null;
    this.age=0;
    this.color = `hsl(${Math.random()*360}, 65%, 60%)`;
    this.abilities = {};
    if(type==='grower'){this.abilities.grow=true;this.baseSize=25;this.size=25}
    if(type==='wrench'){this.abilities.wrench=true;this.baseSize=28;this.size=28}
    if(type==='swinger'){this.abilities.swing=true;this.baseSize=30;this.size=30}
    
    // Start with random straight-line velocity
    let angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    
    this.id = Ball.nextId++;
    this.selected = false;
    this.contactStart = {}; // Track when contact started with each ball
    this.bounceCooldown = {}; // Prevent immediate re-bounce
  }

  isAlive(){return this.health>0}

  takeDamage(d){this.health-=d; if(this.health<0)this.health=0}

  findTarget(list){
    let best=null; let bd=1e9;
    for(let b of list){
      if(b===this||!b.isAlive()||b.team===this.team) continue;
      let d2 = (b.x-this.x)*(b.x-this.x)+(b.y-this.y)*(b.y-this.y);
      if(d2<bd){bd=d2;best=b}
    }
    this.target=best;
  }

  applyAbilities(game){
    if(this.abilities.grow){ // grow as it deals/receives damage
      if(this.size<60) this.size += 0.005; // slow growth over time
      // if deal damage, handled elsewhere to bump size
    }
    if(this.abilities.wrench){
      // spawn turret every 3 seconds (1/180 at 60fps)
      if(Math.random()<0.0056){
        game.spawnTurret(this.x+rand(-20,20),this.y+rand(-20,20),this.team);
      }
    }
    if(this.abilities.swing){
      // ensure it has a swinging orb
      if(!this.swingOrb || !this.swingOrb.alive){
        this.swingOrb = {angle: Math.random()*Math.PI*2, r: this.size+20, alive:true};
      }
      this.swingOrb.angle += 0.12; // spin speed
    }
  }

  step(game, list){
    if(!this.isAlive()) return;
    this.age++;
    
    // Scale size based on health
    let healthPercent = this.health / this.maxHealth;
    if(this.abilities.grow){
      // Grower: grows as health decreases
      this.size = this.baseSize + (1 - healthPercent) * this.baseSize * 1.5;
    } else {
      // Normal: shrinks as health decreases
      this.size = this.baseSize * (0.5 + healthPercent * 0.5); // 50% to 100% size
    }
    
    // Just move in straight line at constant speed - no acceleration
    this.update();
    
    // Square map boundaries (centered)
    let mapSize = Math.min(W,H) - 100;
    let mapX = (W-mapSize)/2;
    let mapY = (H-mapSize)/2;
    if(this.x < mapX+this.size){this.x=mapX+this.size;this.vx*=-0.7}
    if(this.y < mapY+this.size){this.y=mapY+this.size;this.vy*=-0.7}
    if(this.x > mapX+mapSize-this.size){this.x=mapX+mapSize-this.size;this.vx*=-0.7}
    if(this.y > mapY+mapSize-this.size){this.y=mapY+mapSize-this.size;this.vy*=-0.7}

    // apply abilities
    this.applyAbilities(game);

    // Turret collision (bounce off turrets)
    for(let turret of game.turrets){
      if(!turret.alive) continue;
      let dx = this.x - turret.x;
      let dy = this.y - turret.y;
      let dist = Math.hypot(dx,dy);
      let minDist = this.size + 10; // turret is ~12px square, use 10 as radius
      if(dist < minDist && dist > 0){
        // Bounce off turret
        let overlap = minDist - dist;
        let nx = dx/dist;
        let ny = dy/dist;
        this.x += nx * overlap;
        this.y += ny * overlap;
        
        // Reflect velocity
        let dotProd = this.vx*nx + this.vy*ny;
        this.vx -= 2 * dotProd * nx * 0.9;
        this.vy -= 2 * dotProd * ny * 0.9;
        
        // Small damage from hitting turret (reduced by 5x)
        this.takeDamage(0.1);
      }
    }

    // Ball-to-ball collision - bounce after 0.5 seconds of sustained contact
    for(let other of list){
      if(other === this || !other.isAlive()) continue;

      let otherId = other.id;

      // Initialize tracking variables
      if(!this.contactStart[otherId]) this.contactStart[otherId] = 0;
      if(!this.bounceCooldown[otherId]) this.bounceCooldown[otherId] = 0;

      // Decrement cooldown
      if(this.bounceCooldown[otherId] > 0) this.bounceCooldown[otherId]--;

      let dx = other.x - this.x;
      let dy = other.y - this.y;
      let dist = Math.hypot(dx,dy);
      let minDist = this.size + other.size;

      if(dist < minDist && dist > 0){
        // Balls are touching

        // ALWAYS prevent overlap - keep balls separated during contact
        let overlap = minDist - dist;
        let nx = dx / dist;
        let ny = dy / dist;

        // Push balls apart to prevent overlap
        this.x -= nx * overlap * 0.5;
        this.y -= ny * overlap * 0.5;
        other.x += nx * overlap * 0.5;
        other.y += ny * overlap * 0.5;

        // Only track contact time if not in cooldown
        if(this.bounceCooldown[otherId] === 0){
          this.contactStart[otherId]++;

          // After 0.5 seconds (30 frames), apply STRONG bounce
          if(this.contactStart[otherId] >= 30){

            // Apply elastic collision physics with STRONG bounce
            let mass1 = this.size;
            let mass2 = other.size;

            // Relative velocity along collision normal
            let dvx = this.vx - other.vx;
            let dvy = this.vy - other.vy;
            let dvn = dvx * nx + dvy * ny;

            // Calculate impulse for elastic collision with restitution coefficient
            let restitution = 1.2; // Greater than 1 for extra bounce power
            let impulse = ((1 + restitution) * dvn) / (1/mass1 + 1/mass2);

            // Apply velocity changes
            this.vx -= impulse * nx / mass1;
            this.vy -= impulse * ny / mass1;
            other.vx += impulse * nx / mass2;
            other.vy += impulse * ny / mass2;

            // Add extra separation push to ensure they fly apart
            let pushForce = 5;
            this.x -= nx * pushForce;
            this.y -= ny * pushForce;
            other.x += nx * pushForce;
            other.y += ny * pushForce;

            // Collision damage
            let impactVel = Math.hypot(dvx, dvy);
            let dmg = Math.max(0.06, impactVel * 0.016);
            this.takeDamage(dmg);
            other.takeDamage(dmg);

            // Reset contact timer and set cooldown (60 frames = 1 second)
            this.contactStart[otherId] = 0;
            this.bounceCooldown[otherId] = 60;

            // Mirror for other ball
            if(!other.contactStart[this.id]) other.contactStart[this.id] = 0;
            if(!other.bounceCooldown[this.id]) other.bounceCooldown[this.id] = 0;
            other.contactStart[this.id] = 0;
            other.bounceCooldown[this.id] = 60;

            // Rewards
            if(this.abilities.grow) this.baseSize += 0.08;
            this.damage *= 1.001;
          }
        }
      } else {
        // Not touching - reset contact timer
        this.contactStart[otherId] = 0;
      }
    }
  }

  draw(ctx){
    if(!this.isAlive()) return;
    ctx.save();
    ctx.translate(this.x,this.y);
    
    // Selection highlight
    if(this.selected){
      ctx.beginPath();
      ctx.arc(0,0,this.size+4,0,Math.PI*2);
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    
    // body with outline
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(0,0,this.size,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Health number ON the ball (Earclacks style)
    ctx.fillStyle = '#000';
    ctx.font = `bold ${Math.floor(this.size*0.8)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(this.health), 0, 0);
    
    ctx.restore();

    // draw swing orb
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
  constructor(x,y,team){super(x,y);this.team=team;this.cool=0}
  step(game){
    if(!this.alive) return;
    this.cool--;
    if(this.cool<0){
      this.cool = 120; // Slower fire rate (was 50)
      // fire at nearest ball (any since FFA)
      let target=null; let bd=1e9;
      let bounds = game.getMapBounds();
      for(let b of game.balls){
        if(!b.isAlive()) continue;
        // Only target balls within map boundaries
        if(b.x < bounds.minX || b.x > bounds.maxX || b.y < bounds.minY || b.y > bounds.maxY) continue;
        let d2=(b.x-this.x)*(b.x-this.x)+(b.y-this.y)*(b.y-this.y);
        if(d2<bd){bd=d2;target=b}
      }
      if(target){
        let ang = Math.atan2(target.y-this.y,target.x-this.x);
        game.projectiles.push(new Projectile(this.x,this.y,Math.cos(ang)*6,Math.sin(ang)*6,this.team,0.3)); // Reduced by 5x
      }
    }
  }
  draw(ctx){ctx.beginPath();ctx.fillStyle='#c7b2ff';ctx.rect(this.x-6,this.y-6,12,12);ctx.fill()}
}

class Projectile extends Entity{
  constructor(x,y,vx,vy,team,dmg){super(x,y);this.vx=vx;this.vy=vy;this.team=team;this.dmg=dmg;this.life=120}
  step(game){
    this.update();
    this.life--;
    if(this.life<0) this.dead=true;
    // Die at screen boundaries
    if(this.x<0||this.y<0||this.x>W||this.y>H) this.dead=true;
    // Die at map boundaries
    let bounds = game.getMapBounds();
    if(this.x<bounds.minX||this.x>bounds.maxX||this.y<bounds.minY||this.y>bounds.maxY) this.dead=true;
  }
  draw(ctx){ctx.beginPath();ctx.fillStyle='#ffd166';ctx.arc(this.x,this.y,4,0,Math.PI*2);ctx.fill()}
}

class Game{
  constructor(){this.balls=[];this.turrets=[];this.projectiles=[];this.spawnPos={x:W/2,y:H/2}}

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

  spawnBall(x,y,type){let b=new Ball(x,y,type);this.balls.push(b);return b}

  spawnTurret(x,y,team){
    // Clamp turret position to map boundaries
    let pos = this.clampToMap(x,y,20);
    let t=new Turret(pos.x,pos.y,team);
    t.alive=true;
    this.turrets.push(t);
  }

  spawnProjectile(p){this.projectiles.push(p)}
  step(){
    for(let t of this.turrets) t.step(this);
    for(let p of this.projectiles) p.step(this);
    // projectile collisions (FFA - hit any ball)
    for(let p of this.projectiles){
      for(let b of this.balls){ if(!b.isAlive()) continue; let d=Math.hypot(p.x-b.x,p.y-b.y); if(d < b.size+4){ b.takeDamage(p.dmg); p.dead=true; }}
    }
    this.projectiles = this.projectiles.filter(p=>!p.dead);

    // swing orb damage (FFA - hit anyone, reduced by 5x)
    for(let b of this.balls){ if(b.abilities.swing && b.swingOrb && b.swingOrb.alive){
      let sx = b.x+Math.cos(b.swingOrb.angle)*b.swingOrb.r; let sy = b.y+Math.sin(b.swingOrb.angle)*b.swingOrb.r;
      for(let o of this.balls){ if(o===b||!o.isAlive()) continue; let d=Math.hypot(sx-o.x,sy-o.y); if(d<12){ o.takeDamage(0.3); b.damage*=1.0002 }}
    }}

    for(let b of this.balls) b.step(this,this.balls);

    // remove dead
    this.balls = this.balls.filter(b=>b.isAlive());
    this.turrets = this.turrets.filter(t=>t.alive!==false);
  }
  draw(ctx){
    ctx.fillStyle = '#f5f5dc'; // Beige background like Earclacks
    ctx.fillRect(0,0,W,H);
    
    // Square map boundary (centered)
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
  }
}

const game = new Game();

function updateSidebar(){
  const list = document.getElementById('ballList');
  list.innerHTML = '';
  game.balls.forEach(b => {
    const item = document.createElement('div');
    item.className = 'ball-item' + (b.selected ? ' selected' : '');
    item.innerHTML = `
      <div style="background:${b.color}" class="ball-color"></div>
      <span>ID:${b.id} ${b.type} HP:${Math.ceil(b.health)}</span>
      <input type="number" value="${Math.floor(b.team)}" class="team-input" data-id="${b.id}" />
    `;
    item.addEventListener('click', (e) => {
      if(e.target.classList.contains('team-input')) return;
      b.selected = !b.selected;
      updateSidebar();
    });
    list.appendChild(item);
  });
  
  // Team input handlers
  document.querySelectorAll('.team-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = parseInt(e.target.dataset.id);
      const ball = game.balls.find(b => b.id === id);
      if(ball) ball.team = parseFloat(e.target.value);
    });
  });
}

// basic spawn of random balls
for(let i=0;i<6;i++) game.spawnBall(rand(100,W-100),rand(100,H-100),['basic','grower','wrench','swinger'][Math.floor(Math.random()*4)]);

function loop(){ game.step(); game.draw(ctx); document.getElementById('count').innerText = game.balls.length; updateSidebar(); requestAnimationFrame(loop)}
loop();

// UI
let spawnType = document.getElementById('type');
document.getElementById('spawn').addEventListener('click', ()=>{ 
  let b = game.spawnBall(game.spawnPos.x,game.spawnPos.y,spawnType.value);
  b.team = parseFloat(document.getElementById('spawnTeam').value);
});
document.getElementById('spawnPair').addEventListener('click', ()=>{ 
  let team = parseFloat(document.getElementById('spawnTeam').value);
  let a=game.spawnBall(rand(100,W-100),rand(100,H-100),spawnType.value); 
  a.team = team;
  let b=game.spawnBall(rand(100,W-100),rand(100,H-100),['basic','grower','wrench','swinger'][Math.floor(Math.random()*4)]); 
  b.team = team + 1;
});
document.getElementById('restart').addEventListener('click', ()=>{ location.reload() });

// Cross mechanic: pick two nearest balls to spawn a hybrid
document.getElementById('cross').addEventListener('click', ()=>{
  if(game.balls.length<2) return;
  // pick two random different
  let a = game.balls[Math.floor(Math.random()*game.balls.length)];
  let b = game.balls[Math.floor(Math.random()*game.balls.length)];
  if(a===b) return;
  // hybrid: inherit abilities and average stats
  let h = new Ball((a.x+b.x)/2,(a.y+b.y)/2,'basic');
  h.abilities = {...a.abilities,...b.abilities};
  h.size = Math.max(18, (a.size+b.size)/2);
  h.speed = (a.speed+b.speed)/2;
  h.damage = (a.damage+b.damage)/2;
  h.team = Math.random()*10000; // Unique team for FFA
  game.balls.push(h);
});

canvas.addEventListener('click', (e)=>{
  const rect = canvas.getBoundingClientRect();
  game.spawnPos.x = e.clientX - rect.left; game.spawnPos.y = e.clientY - rect.top;
});

// Team assignment
document.getElementById('assignTeam').addEventListener('click', () => {
  const teamNum = parseFloat(document.getElementById('teamNumber').value);
  game.balls.forEach(b => { if(b.selected) b.team = teamNum });
});

document.getElementById('newTeam').addEventListener('click', () => {
  const teamNum = Math.floor(Math.random()*100);
  document.getElementById('teamNumber').value = teamNum;
  game.balls.forEach(b => { if(b.selected) b.team = teamNum });
});

// Note: This project is inspired-by Earclacks mechanics (grower, turret spawner, swinger) but is an original implementation.
