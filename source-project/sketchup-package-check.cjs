const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const build=JSON.parse(fs.readFileSync(path.join(__dirname,'outputs/sketchup/latest-build.json'),'utf8'));
const html=fs.readFileSync(path.join(build.web,'index.html'),'utf8');
const files=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(x=>x[1]).filter(x=>/\.(js|css|woff2|svg|webmanifest)$/.test(x));
for(const file of files)assert.ok(fs.existsSync(path.join(build.web,file)),'Missing '+file);
assert.ok(!html.includes('<script src="pwa.js"'));
assert.ok(!fs.readFileSync(path.join(build.web,'internal-report.js'),'utf8').includes('/MedeoSans-'));
const zip=fs.readFileSync(build.archive),hash=b=>crypto.createHash('sha256').update(b).digest('hex');assert.equal(hash(zip),build.sha256);
const end=zip.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));assert.ok(end>=0,'ZIP directory missing');
let offset=zip.readUInt32LE(end+16),count=0;const entries=zip.readUInt16LE(end+10);
for(let i=0;i<entries;i++){
 assert.equal(zip.readUInt32LE(offset),0x02014b50);const method=zip.readUInt16LE(offset+10),size=zip.readUInt32LE(offset+20),uncompressed=zip.readUInt32LE(offset+24),nameLength=zip.readUInt16LE(offset+28),extraLength=zip.readUInt16LE(offset+30),commentLength=zip.readUInt16LE(offset+32),local=zip.readUInt32LE(offset+42);
 const name=zip.subarray(offset+46,offset+46+nameLength).toString('utf8').replaceAll('\\','/');offset+=46+nameLength+extraLength+commentLength;
 assert.ok(!name.startsWith('/')&&!name.split('/').includes('..'),'Unsafe archive path');assert.ok(!name.includes('/server/')&&!name.includes('/.openai/'),'Server files in extension');
 if(name.endsWith('/'))continue;
 const start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28),compressed=zip.subarray(start,start+size),bytes=method===8?zlib.inflateRawSync(compressed):method===0?compressed:null;
 assert.ok(bytes,'Unsupported compression');assert.equal(bytes.length,uncompressed);assert.equal(hash(bytes),hash(fs.readFileSync(path.join(build.stage,name))),'ZIP data mismatch '+name);count++;
}
assert.ok(count>70);console.log('SketchUp RBZ: '+count+' archived files verified, page assets, host isolation, embedded report fonts and SHA256 passed.');
