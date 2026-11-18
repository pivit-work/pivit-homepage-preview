// 힘펠 PT 를 비밀번호로 잠근 페이지(/himpelpt/)로 만든다.
// 사용: node _tools/himpelpt-build.mjs <pivit-himpel-pt.html 경로> <출력 폴더(himpelpt)>   — 비밀번호는 환경변수 HIMPELPT_PASSWORD
// 이 저장소는 공개라, 출력 폴더에는 암호문만 남긴다. 본문(로고 · 배경 사진을 data URI 로 품음)은 p.bin, 백업 영상은 v/*.bin.
// 키: PBKDF2-SHA256(600,000회 · 무작위 salt) → AES-256-GCM. 파일 모양: [12바이트 IV][암호문+태그]. 비밀번호를 바꾸려면 새 값으로 다시 돌린다.
import fs from 'node:fs';
import path from 'node:path';
import { webcrypto as crypto } from 'node:crypto';

const [src, out] = process.argv.slice(2);
const pw = process.env.HIMPELPT_PASSWORD;
if (!src || !out || !pw) { console.error('usage: HIMPELPT_PASSWORD=… node himpelpt-build.mjs <pt.html> <outdir>'); process.exit(1); }
const ITER = 600000;
const srcDir = path.dirname(src);
let html = fs.readFileSync(src, 'utf8');

// 작은 이미지 자산은 본문에 품는다
const mime = { '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
html = html.replace(/assets\/himpel\/[A-Za-z0-9_.-]+\.(webp|png|jpg)/g, (m) => {
  const b = fs.readFileSync(path.join(srcDir, m));
  return `data:${mime[path.extname(m)]};base64,${b.toString('base64')}`;
});
// 영상은 버튼을 누를 때 내려받아 푼다 — 배포본에서만 openVideo 를 바꾼다
const ORIG = "function openVideo(src,cap){vp.src=src;document.getElementById('vcap').textContent=cap||'';vm.classList.add('on');vp.currentTime=0;vp.play().catch(()=>{});}";
if (!html.includes(ORIG)) { console.error('openVideo 원문이 바뀌었다 — 빌드 스크립트를 고친다'); process.exit(1); }
html = html.replace(ORIG, "function openVideo(src,cap){document.getElementById('vcap').textContent=cap||'';vm.classList.add('on');Promise.resolve(window.__pv?window.__pv(src):src).then(u=>{vp.src=u;vp.currentTime=0;vp.play().catch(()=>{});});}");
const videos = [...new Set(html.match(/assets\/himpel\/[A-Za-z0-9_.-]+\.mp4/g) || [])];
for (const v of videos) html = html.split(v).join('v/' + path.basename(v, '.mp4') + '.bin');
html = html.replace('<head>', '<head><meta name="robots" content="noindex,nofollow">');

const salt = crypto.getRandomValues(new Uint8Array(16));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
async function seal(bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const o = new Uint8Array(12 + ct.length); o.set(iv); o.set(ct, 12); return o;
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'v'), { recursive: true });
fs.writeFileSync(path.join(out, 'p.bin'), await seal(new TextEncoder().encode(html)));
for (const v of videos) fs.writeFileSync(path.join(out, 'v', path.basename(v, '.mp4') + '.bin'), await seal(fs.readFileSync(path.join(srcDir, v))));

const loader = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>pivit · 힘펠 방문 미팅</title>
<style>
:root{--bg:#f6f7f8;--card:#fff;--strong:#2c3744;--sub:#687079;--line:#e6e8ea;--brand:#2dbd82;--brand-d:#21a67a;--err:#e5484d}
@media (prefers-color-scheme:dark){:root{--bg:#14171a;--card:#1d2125;--strong:#eef0f2;--sub:#9aa1a9;--line:#2c3238}}
*{box-sizing:border-box}html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--strong);font-family:-apple-system,'Apple SD Gothic Neo','Pretendard',sans-serif;display:flex;align-items:center;justify-content:center;padding:16px}
form{width:100%;max-width:360px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:28px 24px}
h1{font-size:19px;margin:0 0 6px}p{font-size:14px;color:var(--sub);margin:0 0 18px;line-height:1.5}
input{width:100%;font-size:16px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:transparent;color:var(--strong)}
input:focus{outline:2px solid var(--brand);border-color:transparent}
button{margin-top:12px;width:100%;font-size:15px;font-weight:700;padding:12px;border:0;border-radius:12px;background:var(--brand);color:#fff;cursor:pointer}
button:hover{background:var(--brand-d)}button:disabled{opacity:.6;cursor:wait}
.err{color:var(--err);font-size:13px;min-height:18px;margin-top:10px}
</style></head><body>
<form id="f" autocomplete="off"><h1>힘펠 방문 미팅 자료</h1><p>전달받은 비밀번호를 입력해 주세요.</p>
<input id="pw" type="password" placeholder="비밀번호" autofocus aria-label="비밀번호"><button id="b">열기</button><div class="err" id="e"></div></form>
<script>
const SALT=Uint8Array.from(atob('${Buffer.from(salt).toString('base64')}'),c=>c.charCodeAt(0)),ITER=${ITER};
async function open_(k,u){const b=new Uint8Array(await (await fetch(u,{cache:'no-store'})).arrayBuffer());return crypto.subtle.decrypt({name:'AES-GCM',iv:b.slice(0,12)},k,b.slice(12));}
document.getElementById('f').addEventListener('submit',async ev=>{ev.preventDefault();const btn=document.getElementById('b'),e=document.getElementById('e');btn.disabled=true;e.textContent='';
 try{const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(document.getElementById('pw').value),'PBKDF2',false,['deriveKey']);
  const k=await crypto.subtle.deriveKey({name:'PBKDF2',salt:SALT,iterations:ITER,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['decrypt']);
  const html=new TextDecoder().decode(await open_(k,'p.bin'));const cache={};
  window.__pv=u=>cache[u]||(cache[u]=open_(k,u).then(x=>URL.createObjectURL(new Blob([x],{type:'video/mp4'}))));
  document.open();document.write(html);document.close();
 }catch(_){e.textContent='비밀번호가 맞지 않습니다.';btn.disabled=false;}});
</script></body></html>
`;
fs.writeFileSync(path.join(out, 'index.html'), loader);
console.log('built', out, 'videos', videos.length, 'p.bin', fs.statSync(path.join(out, 'p.bin')).size);
