import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8931/index.html',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>localStorage.setItem('fuin_team_v1', JSON.stringify({
  teamId:'T',teamName:'t',route:'A',points:{},finalGate:{solvedAt:'x',wrong:0,hintClicked:false}})));
async function attempt(a,b_){
  await p.fill('#word1',a); await p.fill('#word2',b_);
  await p.click('#submitBtn'); await p.waitForTimeout(350);
  return (await p.locator('#feedback').textContent()).trim();
}
await p.goto('http://127.0.0.1:8931/secret.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(900);
await p.click('#beginSecretBtn'); await p.waitForTimeout(300);
console.log('ラベル1:', (await p.locator('#word1Label').textContent()).trim());
console.log('ラベル2:', (await p.locator('#word2Label').textContent()).trim());
console.log('空欄        →', await attempt('',''));
console.log('両方ちがう  →', await attempt('たいよう','つき'));
console.log('片方だけ    →', await attempt('おやこ','つき'));
console.log('同じ語2回   →', await attempt('おやこ','おやこ'));
console.log('逆順        →', await attempt('がっこう','おやこ'));
await p.waitForTimeout(1800);
console.log('クリア表示  :', await p.locator('#clearCard').isVisible());
await p.screenshot({ path:'/tmp/claude-0/secret_clear.png', fullPage:true });
// 漢字＋カタカナでも通るか（リセットして再挑戦）
await p.click('#debugResetBtn').catch(()=>{});
await p.evaluate(()=>{const t=JSON.parse(localStorage.getItem('fuin_team_v1'));t.secretGate=null;localStorage.setItem('fuin_team_v1',JSON.stringify(t));});
await p.goto('http://127.0.0.1:8931/secret.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(900); await p.click('#beginSecretBtn'); await p.waitForTimeout(300);
console.log('漢字＋カナ  →', await attempt('親子','ガッコウ'));
await p.waitForTimeout(1800);
console.log('クリア表示  :', await p.locator('#clearCard').isVisible());
await p.locator('#secretCard').screenshot({ path:'/tmp/claude-0/secret_form.png' }).catch(()=>{});
await b.close();
console.log(errs.length ? 'ERRORS: '+errs.join(' | ') : 'JSエラーなし');
