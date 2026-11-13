// 미리보기 공고 화면의 공고 하나 주소(notice/<번호>/index.html)를 만든다 — 그 주소에만 그 공고의 링크 미리보기(제목·설명)가 붙는다(PW-2344).
// 운영 저장소는 notice-sync 가 5분마다 만들지만, 이 저장소의 공고는 dev 시험 공고 사본(고정)이라 손으로 돌린다.
// notice/index.html(셸)이나 notice/data/ 를 바꾸면 다시 돌린다:  node _tools/notice-pages.mjs ../pivit-homepage
// 만드는 규칙은 운영 저장소 _notice/sync.mjs 의 noticePageHtml 을 그대로 부른다(두 사이트가 같은 모양).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const prodRepo = process.argv[2];
if (!prodRepo) { console.error('사용: node _tools/notice-pages.mjs <pivit-homepage 저장소 경로>'); process.exit(2); }
const { noticePageHtml } = await import(pathToFileURL(path.resolve(prodRepo, '_notice/sync.mjs')).href);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const template = fs.readFileSync(path.join(root, 'notice/index.html'), 'utf8');
const { items } = JSON.parse(fs.readFileSync(path.join(root, 'notice/data/list.json'), 'utf8'));
for (const { no } of items) {
  const d = JSON.parse(fs.readFileSync(path.join(root, `notice/data/${no}.json`), 'utf8'));
  const out = path.join(root, `notice/${no}/index.html`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, noticePageHtml(template, d));
}
console.log(`공고 ${items.length}건의 주소 파일을 만들었습니다`);
