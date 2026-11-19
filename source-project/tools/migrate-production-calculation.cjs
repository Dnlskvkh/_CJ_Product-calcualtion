const fs=require('node:fs'),path=require('node:path');
const core=require('../dist/production-model-core.js'),schema=require('../dist/domain-schema.js'),catalog=require('../dist/production-catalog.js');
const args=process.argv.slice(2);if(args.length!==2)throw Error('Использование: node tools/migrate-production-calculation.cjs исходный.json новая-копия.json');
const [input,output]=args.map(f=>path.resolve(f));if(input===output||fs.existsSync(output))throw Error('Новая копия должна иметь отдельное свободное имя');
const raw=fs.readFileSync(input,'utf8');if(Buffer.byteLength(raw)>1500000)throw Error('Калькуляция больше 1,5 МБ');const original=JSON.parse(raw);schema.calculation(original);const migrated=core.migrate(original,catalog.operations);schema.calculation(migrated);fs.writeFileSync(output,JSON.stringify(migrated,null,2),{flag:'wx'});
console.log('Создана отдельная копия; исходник не изменён:',output);console.log('Перед согласованием проверьте варианты работ, единицы, ставки, плановые затраты и итог; старая методика сохранена в исходном файле.');
