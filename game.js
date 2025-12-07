const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const blockSize = 24;
const rows = 20;
const cols = 10;

const startBtn = document.getElementById('startBtn');
const dogeGif = document.getElementById('dogeGif');
const peterGoldGif = document.getElementById('peterGoldGif');
const bgMusic = document.getElementById('bgMusic');
const barkSound = document.getElementById('barkSound');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const restartBtn = document.getElementById('restartBtn');

// Coin images
const coinImages = {
  BTC: 'images/BTC.png',
  ETH: 'images/ETH.png',
  DOGE: 'images/DOGE.png',
  SOL: 'images/SOL.png',
  XRP: 'images/XRP.png'
};
const coinTypes = Object.keys(coinImages);
let images = {};
for (let k of coinTypes) {
  let img = new Image();
  img.src = coinImages[k];
  images[k] = img;
}

// Scores & grid
let score = { BTC: 0, ETH: 0, DOGE: 0, SOL: 0, XRP: 0 };
let dogeShown = false;
let peterGoldShown = false;
let grid = Array.from({ length: rows }, () => Array(cols).fill(null));

// Peter Gold blocks state
let goldMode = false;
let goldBlocksDropped = 0; // 10 gold
let specialBlocksDropped = 0; // 2 special F/U

// Tetrominoes
const tetrominoes = {
  I: [[1,1,1,1]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1]],
  S: [[0,1,1],[1,1,0]],
  Z: [[1,1,0],[0,1,1]],
  J: [[1,0,0],[1,1,1]],
  L: [[0,0,1],[1,1,1]]
};

// Current piece
let current = null;
let dropCounter = 0;
let dropInterval = 500;
let lastTime = 0;
let gameActive = false;
let paused = false;

// Particles
let particles = [];
function createParticles(x, y, coin) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x: x + blockSize / 2,
      y: y + blockSize / 2,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * -3,
      alpha: 1,
      coin: coin,
      size: Math.random() * blockSize / 2 + 4
    });
  }
}

function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    ctx.globalAlpha = p.alpha;
    if (p.coin === 'GOLD' || p.coin === 'F' || p.coin === 'U') {
      drawGoldBlock(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    } else {
      ctx.drawImage(images[p.coin], p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    if (!paused) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.alpha -= 0.03;
      if (p.alpha <= 0) particles.splice(i, 1);
    }
  }
}

// Draw gold block (shiny)
function drawGoldBlock(x, y, w, h) {
  const gradient = ctx.createLinearGradient(x, y, x+w, y+h);
  gradient.addColorStop(0, '#FFF8DC');
  gradient.addColorStop(0.5, '#FFD700');
  gradient.addColorStop(1, '#FFA500');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x+4, y);
  ctx.lineTo(x+w-4, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+4);
  ctx.lineTo(x+w, y+h-4);
  ctx.quadraticCurveTo(x+w, y+h, x+w-4, y+h);
  ctx.lineTo(x+4, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-4);
  ctx.lineTo(x, y+4);
  ctx.quadraticCurveTo(x, y, x+4, y);
  ctx.fill();
}

// Random Tetromino
function randomTetromino() {
  if (goldMode) {
    if (goldBlocksDropped < 10) {
      goldBlocksDropped++;
      const keys = Object.keys(tetrominoes);
      const key = keys[Math.floor(Math.random()*keys.length)];
      const shape = tetrominoes[key];
      const coins = shape.map(row=>row.map(cell=>cell?'GOLD':null));
      return {shape, coins, x: Math.floor(cols/2) - Math.floor(shape[0].length/2), y:0};
    } else if (specialBlocksDropped < 2) {
      specialBlocksDropped++;
      let shape, coins;
      if (specialBlocksDropped === 1) { // F
        shape = [
          [1,1,1,1],
          [1,0,0,0],
          [1,1,1,0],
          [1,0,0,0],
          [1,0,0,0]
        ];
        coins = shape.map(row => row.map(cell=>cell?'F':null));
      } else { // U
        shape = [
          [1,0,0,1],
          [1,0,0,1],
          [1,0,0,1],
          [1,0,0,1],
          [1,1,1,1]
        ];
        coins = shape.map(row => row.map(cell=>cell?'U':null));
      }
      return {shape, coins, x: Math.floor(cols/2)-2, y: -shape.length}; // spawn above canvas
    } else {
      goldMode = false;
      peterGoldGif.style.display='none';
    }
  }

  const spawnPool = ['I','O','T','S','Z','J','L'];
  const key = spawnPool[Math.floor(Math.random()*spawnPool.length)];
  const shape = tetrominoes[key];
  let coins;
  if(Math.random()<0.2){
    const coinType = coinTypes[Math.floor(Math.random()*coinTypes.length)];
    coins = shape.map(row=>row.map(cell=>cell?coinType:null));
  } else {
    coins = shape.map(row=>row.map(cell=>cell?coinTypes[Math.floor(Math.random()*coinTypes.length)]:null));
  }
  return {shape, coins, x: Math.floor(cols/2) - Math.floor(shape[0].length/2), y:0};
}

// Draw grid
function drawGrid() {
  ctx.clearRect(0,0,cols*blockSize,rows*blockSize);
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      if(grid[r][c]){
        if(grid[r][c]==='GOLD' || grid[r][c]==='F' || grid[r][c]==='U'){
          drawGoldBlock(c*blockSize,r*blockSize,blockSize,blockSize);
        } else ctx.drawImage(images[grid[r][c]], c*blockSize,r*blockSize,blockSize,blockSize);
      }
    }
  }

  if(current){
    for(let r=0;r<current.shape.length;r++){
      for(let c=0;c<current.shape[0].length;c++){
        if(current.shape[r][c] && current.coins[r][c]){
          if(current.coins[r][c]==='GOLD' || current.coins[r][c]==='F' || current.coins[r][c]==='U'){
            drawGoldBlock((current.x+c)*blockSize,(current.y+r)*blockSize,blockSize,blockSize);
          } else ctx.drawImage(images[current.coins[r][c]], (current.x+c)*blockSize,(current.y+r)*blockSize,blockSize,blockSize);
        }
      }
    }
  }

  drawParticles();

  if(paused){
    ctx.fillStyle='rgba(0,0,0,0.7)';
    ctx.fillRect(0,0,cols*blockSize,rows*blockSize);
    ctx.fillStyle='white';
    ctx.font='36px monospace';
    ctx.textAlign='center';
    ctx.fillText('PAUSED', cols*blockSize/2, rows*blockSize/2);
  }
}

// Collision check
function collisionAt(tet,xOffset=0,yOffset=0){
  if(!tet) return false;
  const shape = tet.shape;
  for(let r=0;r<shape.length;r++){
    for(let c=0;c<shape[0].length;c++){
      if(shape[r][c]){
        const nx = tet.x + c + xOffset;
        const ny = tet.y + r + yOffset;
        if(nx<0 || nx>=cols || ny>=rows) return true;
        if(ny>=0 && grid[ny][nx]) return true;
      }
    }
  }
  return false;
}

// Merge tetromino
function mergeTetromino(){
  if(!current) return;
  for(let r=0;r<current.shape.length;r++){
    for(let c=0;c<current.shape[0].length;c++){
      if(current.shape[r][c] && current.coins[r][c]){
        const gx = current.x+c;
        const gy = current.y+r;
        if(gy>=0) grid[gy][gx] = current.coins[r][c];
      }
    }
  }
}

// Clear lines
function clearLines(){
  for(let r=rows-1;r>=0;r--){
    if(grid[r].every(cell=>cell)){
      grid[r].forEach((coin,c)=>{
        if(coin!=='GOLD' && coin!=='F' && coin!=='U'){
          createParticles(c*blockSize,r*blockSize,coin);
          score[coin]+=1;
        } else createParticles(c*blockSize,r*blockSize,'GOLD');
      });
      grid.splice(r,1);
      grid.unshift(Array(cols).fill(null));
      r++;
    }
  }

  if(score.DOGE>=1 && !dogeShown){
    dogeGif.style.display='block';
    dogeShown=true;
    barkSound.play().catch(()=>console.log("Sound blocked"));
  }

  if(score.BTC>=1 && !peterGoldShown){
    peterGoldGif.style.display='block';
    peterGoldShown=true;
    goldMode=true;
    goldBlocksDropped=0;
    specialBlocksDropped=0;
  }

  updateScoreboard();
}

// Rotate tetromino
function rotateTetromino(tet){
  const shape = tet.shape;
  const coins = tet.coins;
  const rowsS = shape.length;
  const colsS = shape[0].length;
  let newShape = Array.from({length:colsS},()=>Array(rowsS).fill(0));
  let newCoins = Array.from({length:colsS},()=>Array(rowsS).fill(null));
  for(let r=0;r<rowsS;r++){
    for(let c=0;c<colsS;c++){
      newShape[c][rowsS-1-r]=shape[r][c];
      newCoins[c][rowsS-1-r]=coins[r][c];
    }
  }
  return {shape:newShape, coins:newCoins};
}

function rotateTetrominoWithKick(tet){
  const rotated = rotateTetromino(tet);
  const oldX = tet.x;
  const oldShape = tet.shape;
  const oldCoins = tet.coins;
  for(let offset of [0,-1,1,-2,2]){
    tet.shape = rotated.shape;
    tet.coins = rotated.coins;
    tet.x = oldX + offset;
    if(!collisionAt(tet,0,0)) return tet;
  }
  tet.shape = oldShape;
  tet.coins = oldCoins;
  tet.x = oldX;
  return tet;
}

// Drop
function drop(){
  if(!current) return;
  if(!collisionAt(current,0,1)){
    current.y++;
  } else {
    mergeTetromino();
    clearLines();
    let next = randomTetromino();
    if(collisionAt(next,0,0)){
      gameActive=false;
      paused=false;
      current=null;
      gameOverOverlay.style.display='flex';
      return;
    }
    current = next;
  }
}

// Controls
document.addEventListener('keydown', e => {
  if(!gameActive) return;

  if(e.key.toLowerCase() === 'p'){
    paused = !paused;
    if(paused) bgMusic.pause();
    else bgMusic.play().catch(()=>console.log("Click canvas để bật nhạc"));
    e.preventDefault();
    return;
  }

  if(paused) return;

  switch(e.key){
    case 'ArrowLeft':
      if(!collisionAt(current,-1,0)) current.x--;
      e.preventDefault();
      break;
    case 'ArrowRight':
      if(!collisionAt(current,1,0)) current.x++;
      e.preventDefault();
      break;
    case 'ArrowDown':
      drop();
      e.preventDefault();
      break;
    case ' ':
    case 'a':
    case 'A':
      current = rotateTetrominoWithKick(current);
      e.preventDefault();
      break;
  }
});

// Game loop
function update(time=0){
  if(!gameActive) return;
  const delta = time-lastTime;
  lastTime=time;
  if(!paused){
    dropCounter+=delta;
    if(dropCounter>dropInterval){
      drop();
      dropCounter=0;
    }
  }
  drawGrid();
  requestAnimationFrame(update);
}

// Start game
bgMusic.volume=0.3;
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', ()=>{location.reload();});

function startGame(){
  startBtn.style.display='none';
  gameOverOverlay.style.display='none';
  grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  score = { BTC:0, ETH:0, DOGE:0, SOL:0, XRP:0 };
  current=randomTetromino();
  dropCounter=0;
  lastTime=performance.now();
  paused=false;
  gameActive=true;
  particles=[];
  dogeGif.style.display='none';
  peterGoldGif.style.display='none';
  goldMode=false;
  goldBlocksDropped=0;
  specialBlocksDropped=0;
  updateScoreboard();
  bgMusic.currentTime=0;
  bgMusic.play().catch(()=>console.log("Click canvas để bật nhạc"));
  update();
}

// Update scoreboard
function updateScoreboard(){
  document.getElementById("btcScore").textContent = `BTC: ${score.BTC}`;
  document.getElementById("ethScore").textContent = `ETH: ${score.ETH}`;
  document.getElementById("dogeScore").textContent = `DOGE: ${score.DOGE}`;
  document.getElementById("solScore").textContent = `SOL: ${score.SOL}`;
  document.getElementById("xrpScore").textContent = `XRP: ${score.XRP}`;
}
