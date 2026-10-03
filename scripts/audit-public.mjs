import {readFileSync,readdirSync} from 'node:fs';
const files=readdirSync('dist',{recursive:true}).map(String);
if(files.some(n=>!/^(?:assets(?:[\\/].+\.(?:js|css))?|index\.html|taiphoon-logo\.png)$/.test(n))) throw Error('Public output contains an unexpected file');
const text=files.filter(n=>n.endsWith('.js')).map(n=>readFileSync('dist/'+n,'utf8')).join('\n');
for(const marker of ['SPIDEV imu1','BAT1_A_PER_V 36','#define TIMER_PIN_MAPPING','GITHUB_APP_CLIENT_SECRET','SESSION_KEY','BEGIN PRIVATE KEY']) if(text.includes(marker)) throw Error('Public output contains private backend or template data');
if(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/.test(text)) throw Error('Public output contains a credential pattern');
console.log('Public frontend boundary verified');
