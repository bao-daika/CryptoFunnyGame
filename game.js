/* Cleaned Full Game JS
   - Peter Gold event (thresholds)
   - During Peter Gold: no scoring on any clear
   - After Peter Gold: Doge Dog event (15 controllable 1x1 DOGE at x=4)
   - Doge blocks movable left/right/down (no rotate), interact with grid and can clear lines
   - Wall-kick, collision safety, particles, scoreboard, pause/restart
*/

// ---------- CONFIG ----------
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const blockSize = 24;
const rows = 20;
const cols = 10;

const startBtn = document.getElementById('startBtn');
const dogeGif = document.getElementById('dogeGif');
const peterGoldGif = document.getElementById('peterGoldGif');
const bgMusic = document.getElementById('bgMusic');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const restartBtn = document.getElementById('restartBtn');

// coin images (paths must exist)
const coinImages = {
  BTC: 'images/BTC.png',
  ETH: 'images/ETH.png',
  DOGE: 'images/DOGE.png',
  SOL: 'images/SOL.png',
  XRP: 'images/XRP.png'
};
const coinTypes = Object.keys(coinImages);
let images = {};
for (let k of coinTypes){
  let img = new Image();
  img.src = coinImages[k];
  images[k] = img;
}

// ---------- GAME STATE ----------
let grid = Array.from({length:rows},()=>Array(cols).fill(null));
let score = {BTC:0, ETH:0, DOGE:0, SOL:0, XRP:0};

// Peter Gold thresholds
const peterThresholds = [10,50,100,200,300,400,500];
let peterTriggered = new Set();

let goldMode = false;
let goldBlocksDropped = 0;
let specialBlocksDropped = 0;

let dogeEventActive = false;
let dogeBlocksRemaining = 0;
let currentDogeBlock = null;

// tetrominoes
const tetrominoes = {
  I:[[1,1,1,1]],
  O:[[1,1],[1,1]],
  T:[[0,1,0],[1,1,1]],
  S:[[0,1,1],[1,1,0]],
  Z:[[1,1,0],[0,1,1]],
  J:[[1,0,0],[1,1,1]],
  L:[[0,0,1],[1,1,1]]
};

// special gold blocks F, U, N
const specialGoldBlocks = [
  {letter:'F', shape:[[1,1,1,1],[1,0,0,0],[1,1,1,0],[1,0,0,0],[1,0,0,0]]},
  {letter:'U', shape:[[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,0,0,1],[1,1,1,1]]},
  {letter:'N', shape:[[1,0,0,0,1],[1,1,0,0,1],[1,0,1,0,1],[1,0,0,1,1],[1,0,0,0,1]]}
];

// current piece
let current = null;
let dropCounter = 0;
let dropInterval = 500;
let lastTime = 0;
let gameActive = false;
let paused = false;

// ---------- PARTICLES ----------
let particles = [];
function createParticles(x,y,coin){
  for(let i=0;i<10;i++){
    particles.push({x:x+blockSize/2, y:y+blockSize/2, vx:(Math.random()-0.5)*2, vy:Math.random()*-3, alpha:1, coin:coin, size:Math.random()*blockSize/2+4});
  }
}
function drawParticles(){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    ctx.globalAlpha = p.alpha;
    if(['GOLD','F','U','N'].includes(p.coin)) drawGoldBlock(p.x-p.size/2,p.y-p.size/2,p.size,p.size);
    else ctx.drawImage(images[p.coin],p.x-p.size/2,p.y-p.size/2,p.size,p.size);
    ctx.globalAlpha=1;
    if(!paused){p.x+=p.vx; p.y+=p.vy; p.vy+=0.05; p.alpha-=0.03; if(p.alpha<=0) particles.splice(i,1);}
  }
}

// ---------- DRAW GOLD BLOCK ----------
function drawGoldBlock(x,y,w,h){
  const g = ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,'#FFF8DC'); g.addColorStop(0.5,'#FFD700'); g.addColorStop(1,'#FFA500');
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(x+4,y); ctx.lineTo(x+w-4,y); ctx.quadraticCurveTo(x+w,y,x+w,y+4);
  ctx.lineTo(x+w,y+h-4); ctx.quadraticCurveTo(x+w,y+h,x+w-4,y+h);
  ctx.lineTo(x+4,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-4);
  ctx.lineTo(x,y+4); ctx.quadraticCurveTo(x,y,x+4,y);
  ctx.fill();
}

// ---------- RANDOM TETROMINO ----------
function randomTetromino(){
  if(goldMode){
    if(goldBlocksDropped<10){
      goldBlocksDropped++;
      const keys = Object.keys(tetrominoes);
      const key = keys[Math.floor(Math.random()*keys.length)];
      const shape = tetrominoes[key];
      const coins = shape.map(row=>row.map(cell=>cell?'GOLD':null));
      return {shape, coins, x:Math.floor(cols/2)-Math.floor(shape[0].length/2), y:0};
    } else if(specialBlocksDropped<specialGoldBlocks.length){
      const s = specialGoldBlocks[specialBlocksDropped++];
      const coins = s.shape.map(r=>r.map(c=>c?s.letter:null));
      return {shape:s.shape, coins, x:Math.floor(cols/2)-Math.floor(s.shape[0].length/2), y:0};
    } else {
      goldMode=false;
      peterGoldGif.style.display='none';
      dogeEventActive=true; dogeBlocksRemaining=15;
      currentDogeBlock = spawnDogeBlock();
      dogeGif.style.display='block';
      return null;
    }
  }

  const pool = ['I','O','T','S','Z','J','L'];
  const key = pool[Math.floor(Math.random()*pool.length)];
  const shape = tetrominoes[key];
  let coins;
  if(Math.random()<0.2){ const ct = coinTypes[Math.floor(Math.random()*coinTypes.length)]; coins = shape.map(r=>r.map(c=>c?ct:null)); }
  else coins = shape.map(r=>r.map(c=>c?coinTypes[Math.floor(Math.random()*coinTypes.length)]:null));
  return {shape, coins, x:Math.floor(cols/2)-Math.floor(shape[0].length/2), y:0};
}

// spawn 1x1 doge block
function spawnDogeBlock(){ return {shape:[[1]], coins:[['DOGE']], x:4, y:0}; }

// ---------- DRAW GRID ----------
function drawGrid(){
  ctx.clearRect(0,0,cols*blockSize,rows*blockSize);
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const cell = grid[r][c];
      if(!cell) continue;
      if(['GOLD','F','U','N'].includes(cell)) drawGoldBlock(c*blockSize,r*blockSize,blockSize,blockSize);
      else ctx.drawImage(images[cell],c*blockSize,r*blockSize,blockSize,blockSize);
    }
  }

  if(current && !dogeEventActive){
    for(let r=0;r<current.shape.length;r++){
      for(let c=0;c<current.shape[0].length;c++){
        if(current.shape[r][c] && current.coins[r][c]){
          const cx=(current.x+c)*blockSize; const cy=(current.y+r)*blockSize;
          const coin=current.coins[r][c];
          if(['GOLD','F','U','N'].includes(coin)) drawGoldBlock(cx,cy,blockSize,blockSize);
          else ctx.drawImage(images[coin],cx,cy,blockSize,blockSize);
        }
      }
    }
  }

  if(dogeEventActive && currentDogeBlock){
    for(let r=0;r<currentDogeBlock.shape.length;r++){
      for(let c=0;c<currentDogeBlock.shape[0].length;c++){
        if(currentDogeBlock.shape[r][c] && currentDogeBlock.coins[r][c]){
          const cx=(currentDogeBlock.x+c)*blockSize;
          const cy=(currentDogeBlock.y+r)*blockSize;
          ctx.drawImage(images['DOGE'],cx,cy,blockSize,blockSize);
        }
      }
    }
  }

  drawParticles();

  if(paused){
    ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(0,0,cols*blockSize,rows*blockSize);
    ctx.fillStyle='white'; ctx.font='36px monospace'; ctx.textAlign='center';
    ctx.fillText('PAUSED',cols*blockSize/2,rows*blockSize/2);
  }
}

// ---------- COLLISION ----------
function collisionAt(tet,xOffset=0,yOffset=0){
  if(!tet) return false;
  const shape = tet.shape;
  for(let r=0;r<shape.length;r++){
    for(let c=0;c<shape[0].length;c++){
      if(!shape[r][c]) continue;
      const nx=tet.x+c+xOffset, ny=tet.y+r+yOffset;
      if(nx<0||nx>=cols||ny>=rows) return true;
      if(ny>=0 && grid[ny][nx]) return true;
    }
  }
  return false;
}

// ---------- MERGE ----------
function mergeTetromino(){
  if(!current) return;
  for(let r=0;r<current.shape.length;r++){
    for(let c=0;c<current.shape[0].length;c++){
      if(current.shape[r][c] && current.coins[r][c]){
        const gx=current.x+c, gy=current.y+r;
        if(gx>=0 && gx<cols && gy>=0 && gy<rows) grid[gy][gx]=current.coins[r][c];
      }
    }
  }
}
function mergeDogeBlock(block){
  if(!block) return;
  for(let r=0;r<block.shape.length;r++){
    for(let c=0;c<block.shape[0].length;c++){
      if(block.shape[r][c] && block.coins[r][c]){
        const gx=block.x+c, gy=block.y+r;
        if(gx>=0 && gx<cols && gy>=0 && gy<rows) grid[gy][gx]=block.coins[r][c];
      }
    }
  }
}

// ---------- CLEAR LINES ----------
function clearLines(){
  for(let r=rows-1;r>=0;r--){
    if(grid[r].every(c=>c)){
      grid[r].forEach((coin,c)=>{
        if(!goldMode && !['GOLD','F','U','N'].includes(coin)){ createParticles(c*blockSize,r*blockSize,coin); score[coin]+=1; }
        else createParticles(c*blockSize,r*blockSize,coin);
      });
      grid.splice(r,1); grid.unshift(Array(cols).fill(null)); r++;
    }
  }
  if(!goldMode) checkPeterGold();
  updateScoreboard();
}

// ---------- PETER GOLD ----------
function checkPeterGold(){
  for(let t of peterThresholds){
    if(score.BTC>=t && !peterTriggered.has(t)){
      peterTriggered.add(t);
      peterGoldGif.style.display='block';
      goldMode=true; goldBlocksDropped=0; specialBlocksDropped=0;
      break;
    }
  }
}

// ---------- ROTATION ----------
function rotateTetromino(tet){
  const shape=tet.shape; const coins=tet.coins;
  const rowsS=shape.length; const colsS=shape[0].length;
  let newShape=Array.from({length:colsS},()=>Array(rowsS).fill(0));
  let newCoins=Array.from({length:colsS},()=>Array(rowsS).fill(null));
  for(let r=0;r<rowsS;r++){
    for(let c=0;c<colsS;c++){
      newShape[c][rowsS-1-r]=shape[r][c];
      newCoins[c][rowsS-1-r]=coins[r][c];
    }
  }
  return {shape:newShape, coins:newCoins};
}
function rotateTetrominoWithKick(tet){
  const rotated=rotateTetromino(tet);
  const oldX=tet.x, oldShape=tet.shape, oldCoins=tet.coins;
  for(let offset of [0,-1,1,-2,2]){
    tet.shape=rotated.shape; tet.coins=rotated.coins; tet.x=oldX+offset;
    if(!collisionAt(tet,0,0)) return tet;
  }
  tet.shape=oldShape; tet.coins=oldCoins; tet.x=oldX;
  return tet;
}

// ---------- DROP ----------
function drop(){
  if(!gameActive) return;

  // Doge Event
  if(dogeEventActive && currentDogeBlock){
    if(!collisionAt(currentDogeBlock,0,1)) currentDogeBlock.y++;
    else {
      mergeDogeBlock(currentDogeBlock);
      clearLines();
      dogeBlocksRemaining--;
      if(dogeBlocksRemaining>0) currentDogeBlock=spawnDogeBlock();
      else { dogeEventActive=false; currentDogeBlock=null; dogeGif.style.display='none'; current=randomTetromino(); }
    }
    return;
  }

  if(!current) return;
  if(!collisionAt(current,0,1)) current.y++;
  else {
    mergeTetromino(); clearLines();
    current=randomTetromino();
    if(!current && dogeEventActive && currentDogeBlock) return;
    if(current && collisionAt(current,0,0) && current.y===0){ gameActive=false; paused=false; current=null; gameOverOverlay.style.display='flex'; return;}
  }
}

// ---------- CONTROLS ----------
document.addEventListener('keydown',e=>{
  if(!gameActive) return;
  if(e.key.toLowerCase()==='p'){ paused=!paused; if(paused) bgMusic.pause(); else bgMusic.play().catch(()=>console.log("Click canvas để bật nhạc")); e.preventDefault(); return;}
  if(paused) return;

  if(dogeEventActive && currentDogeBlock){
    switch(e.key){
      case 'ArrowLeft': if(!collisionAt(currentDogeBlock,-1,0)) currentDogeBlock.x--; e.preventDefault(); break;
      case 'ArrowRight': if(!collisionAt(currentDogeBlock,1,0)) currentDogeBlock.x++; e.preventDefault(); break;
      case 'ArrowDown': if(!collisionAt(currentDogeBlock,0,1)) currentDogeBlock.y++; e.preventDefault(); break;
    }
    return;
  }

  if(!current) return;
  switch(e.key){
    case 'ArrowLeft': if(!collisionAt(current,-1,0)) current.x--; e.preventDefault(); break;
    case 'ArrowRight': if(!collisionAt(current,1,0)) current.x++; e.preventDefault(); break;
    case 'ArrowDown': drop(); e.preventDefault(); break;
    case ' ': case 'a': case 'A': current=rotateTetrominoWithKick(current); e.preventDefault(); break;
  }
});

// ---------- GAME LOOP ----------
function update(time=0){
  if(!gameActive) return;
  const delta=time-lastTime; lastTime=time;
  if(!paused){ dropCounter+=delta; if(dropCounter>dropInterval){ drop(); dropCounter=0; }}
  drawGrid();
  requestAnimationFrame(update);
}

// ---------- START / RESTART ----------
bgMusic.volume=0.3;
startBtn.addEventListener('click',startGame);
restartBtn.addEventListener('click',()=>location.reload());

function startGame(){
  startBtn.style.display='none'; // hide start button
  grid = Array.from({length:rows},()=>Array(cols).fill(null));
  score={BTC:0,ETH:0,DOGE:0,SOL:0,XRP:0};
  peterTriggered.clear();
  dogeEventActive=false; dogeBlocksRemaining=0; currentDogeBlock=null;
  goldMode=false; goldBlocksDropped=0; specialBlocksDropped=0;
  current=randomTetromino();
  dropCounter=0; lastTime=performance.now();
  paused=false; gameActive=true; particles=[];
  dogeGif.style.display='none'; peterGoldGif.style.display='none';
  updateScoreboard();
  bgMusic.currentTime=0; bgMusic.play().catch(()=>console.log("Click canvas để bật nhạc"));
  update();
}

// ---------- SCOREBOARD ----------
function updateScoreboard(){
  const e=id=>document.getElementById(id);
  e("btcScore").textContent=`BTC: ${score.BTC}`;
  e("ethScore").textContent=`ETH: ${score.ETH}`;
  e("dogeScore").textContent=`DOGE: ${score.DOGE}`;
  e("solScore").textContent=`SOL: ${score.SOL}`;
  e("xrpScore").textContent=`XRP: ${score.XRP}`;
}
