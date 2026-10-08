import fs from 'node:fs';
import path from 'node:path';
const siteRoot = process.argv[2] || 'F:/模倣サイト';
const mediaRoot = process.argv[3] || 'F:/河野塾';
const raw = fs.readFileSync(path.join(siteRoot,'js/local-library.js'),'utf8');
const prefix = 'window.localCourseLibrary = ';
const start = raw.indexOf(prefix);
if(start < 0) throw new Error('Library JSON assignment not found');
const library = JSON.parse(raw.slice(start+prefix.length).trim().replace(/;$/, ''));
const curriculum = JSON.parse(fs.readFileSync(path.join(siteRoot,'data/course-curriculum.json'),'utf8'));
const slash = s => s.replaceAll('\\','/');
const collator = new Intl.Collator('ja',{numeric:true});
function scan(dir) {
 if(!fs.existsSync(dir)) return [];
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  if(e.isSymbolicLink())return [];
  const p=path.join(dir,e.name);
  return e.isDirectory()?scan(p):e.isFile()&&/\.mp4$/i.test(e.name)&&!/\.part\.mp4$/i.test(e.name)?[p]:[];
 });
}
const extras = [
 {id:'math_cards',title:'数学解法カード【無料公開】',folder:'数学解法カード【無料公開】'},
 {id:'integer',title:'徹底演習講座【整数】',folder:'徹底演習講座【整数】'},
 {id:'information',title:'徹底基礎講座【情報】',folder:'徹底基礎講座【情報】'},
 {id:'japanese_ct',title:'共通テスト演習講座【国語】',folder:'共通テスト演習講座【国語】'},
 {id:'todai_math',title:'過去問演習講座【東大：理系数学】',folder:'過去問演習講座【東大：理系数学】'},
];
const courses = [...library.courses,...extras.filter(e=>!library.courses.some(c=>c.id===e.id))].map(c=>{
 const files=scan(path.join(mediaRoot,c.folder));
 const entries=files.map(f=>{
  const relative=slash(path.relative(mediaRoot,f));
  const registered=c.videos?.find(v=>v.path===relative);
  const parts=slash(path.relative(path.join(mediaRoot,c.folder),f)).split('/');
  return {key:c.id+':'+parts.join('/'),title:path.basename(f).replace(/\.mp4$/i,''),chapter:registered?.chapter??(parts.length>=3?parts[0]:''),section:registered?.section??(parts.length>=2?parts.at(-2):''),sourcePath:relative,sourceIndex:registered?.index,order:registered?.displayOrder??registered?.index??100000,registered:!!registered};
 }).sort((a,b)=>a.order-b.order||collator.compare(a.sourcePath,b.sourcePath));
 const missing=(c.videos??[]).filter(v=>!files.some(f=>slash(path.relative(mediaRoot,f))===v.path)).map(v=>v.path);
 return {id:c.id,title:c.title,folder:c.folder,teacher:c.teacher??'',chapters:curriculum[c.id]??[],lessons:entries,missing,folderExists:fs.existsSync(path.join(mediaRoot,c.folder))};
});
const report={generatedAt:new Date().toISOString(),siteRoot,mediaRoot,courses};
fs.mkdirSync('verification',{recursive:true});
fs.writeFileSync('verification/source-catalog-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(courses.map(c=>({id:c.id,title:c.title,folder:c.folder,folderExists:c.folderExists,lessons:c.lessons.length,missing:c.missing.length,sections:new Set(c.lessons.map(l=>l.chapter+'/'+l.section)).size,examples:c.lessons.slice(0,3)})),null,2));
