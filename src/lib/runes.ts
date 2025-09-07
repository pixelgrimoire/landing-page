// Generador procedural de runas (5x7) y util para producir dataURL
export class RuneGen {
  WIDTH = 5;
  HEIGHT = 7;
  MIN_WEIGHT = 13;
  MAX_WEIGHT = 25;
  MAX_ELEMENTS = 3;
  bitmap: number[][] = Array.from({ length: this.HEIGHT }, () => Array(this.WIDTH).fill(0));

  private coin(chance: number) { return Math.random() < chance ? 1 : 0; }

  private random1() {
    const b = this.bitmap, coin = this.coin.bind(this);
    b[0][0] = coin(4/5); b[0][2] = coin(4/5); b[0][4] = coin(4/5);
    b[3][0] = coin(4/5); b[3][2] = coin(4/5); b[3][4] = coin(4/5);
    b[6][0] = coin(4/5); b[6][2] = coin(4/5); b[6][4] = coin(3/5);
    b[0][1] = b[0][0] && b[0][2] && coin(3/4); b[0][3] = b[0][2] && b[0][4] && coin(3/4);
    b[1][0] = b[2][0] = b[0][0] && b[3][0] && coin(2/3);
    b[1][2] = b[2][2] = b[0][2] && b[3][2] && coin(1/4);
    b[1][4] = b[2][4] = b[0][4] && b[3][4] && coin(4/5);
    b[3][1] = b[3][0] && b[3][2] && coin(3/4); b[3][3] = b[3][2] && b[3][4] && coin(2/5);
    b[4][0] = b[5][0] = b[3][0] && b[6][0] && coin(3/4);
    b[4][2] = b[5][2] = b[3][2] && b[6][2] && coin(2/4);
    b[4][4] = b[5][4] = b[3][4] && b[6][4] && coin(3/4);
    b[6][1] = b[6][0] && b[6][2] && coin(4/5); b[6][3] = b[6][2] && b[6][4] && coin(4/5);
    if (b[4][2] && b[3][1] != b[3][3]) b[5][2] = 0;
  }
  private random2() {
    const b = this.bitmap, coin = this.coin.bind(this);
    b[0][0] = coin(1/2); b[0][2] = coin(1/2); b[0][4] = coin(1/2);
    b[2][0] = coin(3/4); b[2][2] = coin(3/4); b[2][4] = coin(3/4);
    b[4][0] = coin(1/2); b[4][2] = coin(1/2); b[4][4] = coin(1/2);
    b[6][0] = coin(1/2); b[6][2] = coin(1/2); b[6][4] = coin(1/2);
    b[0][1] = b[0][0] && b[0][2] && coin(1/4); b[0][3] = b[0][2] && b[0][4] && coin(1/4);
    b[1][0] = b[0][0] && b[2][0] && coin(3/4); b[1][2] = b[0][2] && b[2][2] && coin(3/4); b[1][4] = b[0][4] && b[2][4] && coin(3/4);
    b[2][1] = b[2][0] && b[2][2] && coin(3/4); b[2][3] = b[2][2] && b[2][4] && coin(3/4);
    b[3][0] = b[2][0] && b[4][0] && coin(3/4); b[3][2] = b[2][2] && b[4][2] && coin(1/2); b[3][4] = b[2][4] && b[4][4] && coin(3/4);
    b[4][1] = b[4][2]; b[4][3] = b[4][2];
    b[5][0] = b[4][0] && b[6][0] && coin(3/4); b[5][2] = b[4][2] && b[6][2] && coin(1/2); b[5][4] = b[4][4] && b[6][4] && coin(3/4);
    b[6][1] = b[6][0] && b[6][2] && coin(1/4); b[6][3] = b[6][2] && b[6][4] && coin(1/4);
  }
  countNeighbours(x: number, y: number, r = 1) {
    let n = 0; const b = this.bitmap, W=this.WIDTH, H=this.HEIGHT;
    if (x > r-1 && b[y][x-r]) n++;
    if (x < W - r && b[y][x+r]) n++;
    if (y > r-1 && b[y-r][x]) n++;
    if (y < H - r && b[y+r][x]) n++;
    return n;
  }
  private isSymmetric() {
    const b = this.bitmap; let hSym = true, vSym = true;
    for (let y=0; y<this.HEIGHT; y++) {
      if (b[y][0] != b[y][4] || b[y][1] != b[y][3]) { hSym = false; break; }
    }
    for (let x=0; x<this.WIDTH; x++) {
      if (b[0][x] != b[6][x] || b[1][x] != b[5][x] || b[2][x] != b[4][x]) { vSym = false; break; }
    }
    return hSym || vSym;
  }
  private getWeight() { let w = 0; for (let y=0; y<this.HEIGHT; y++) for (let x=0; x<this.WIDTH; x++) if (this.bitmap[y][x]) w++; return w; }
  private isConnected(weight: number) {
    const b = this.bitmap; const W=this.WIDTH, H=this.HEIGHT; let left=false,right=false,top=false,bottom=false;
    for (let y=0; y<H; y++) { left ||= !!b[y][0]; right ||= !!b[y][W-1]; }
    if (!left || !right) return false;
    for (let x=0; x<W; x++) { top ||= !!b[0][x]; bottom ||= !!b[H-1][x]; }
    if (!top || !bottom) return false;
    let dotx=-1, doty=-1;
    for (let y=0; y<H; y++) for (let x=0; x<W; x++) if (b[y][x] && this.countNeighbours(x,y)==0) {
      if (dotx==-1) { if (this.countNeighbours(x,y,2)==0) return false; dotx=x; doty=y; } else { return false; }
    }
    let sx=0, sy=0; outer: for (let y=0;y<H;y++) for (let x=0;x<W;x++) if (b[y][x] && (y!=doty || x!=dotx)) { sx=x; sy=y; break outer; }
    const checked = new Set<number>();
    const dfs = (x:number,y:number):number => {
      const idx = x + y*W; if (!b[y][x] || checked.has(idx)) return 0; checked.add(idx); let a=1;
      if (x>0) a+=dfs(x-1,y); if (x<W-1) a+=dfs(x+1,y); if (y>0) a+=dfs(x,y-1); if (y<H-1) a+=dfs(x,y+1); return a;
    };
    const area = dfs(sx,sy);
    return Math.abs(area - weight) <= this.MAX_ELEMENTS;
  }
  private getRawGlyph() {
    let w=0; do {
      this.bitmap = Array.from({ length: this.HEIGHT }, () => Array(this.WIDTH).fill(0));
      if (Math.random() < 5/7) this.random1(); else this.random2();
      w = this.getWeight();
    } while (w < this.MIN_WEIGHT || w > this.MAX_WEIGHT || !this.isConnected(w));
  }
  getGlyph(symmetryBias = 0.2) {
    do { this.getRawGlyph(); } while (!this.isSymmetric() && Math.random() < symmetryBias);
    return this.bitmap;
  }
}

export function makeRuneDataURL(scale = 4) {
  const gen = new RuneGen(); const bmp = gen.getGlyph();
  const W = gen.WIDTH, H = gen.HEIGHT;
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) return { src: '', w: W*scale, h: H*scale };
  canvas.width = W*scale; canvas.height = H*scale;
  const ctx = canvas.getContext('2d'); if (!ctx) return { src: '', w: W*scale, h: H*scale };
  (ctx as CanvasRenderingContext2D & { imageSmoothingEnabled?: boolean }).imageSmoothingEnabled = false;
  for (let y=0; y<H; y++) for (let x=0; x<W; x++) {
    if (!bmp[y][x]) continue;
    const n = gen.countNeighbours(x,y);
    ctx.fillStyle = n === 1 ? 'rgba(250,204,21,0.6)' : 'rgba(250,204,21,1)';
    ctx.fillRect(x*scale, y*scale, scale, scale);
  }
  return { src: canvas.toDataURL('image/png'), w: W*scale, h: H*scale };
}

