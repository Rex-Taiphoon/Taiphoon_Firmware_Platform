import { readFileSync, writeFileSync } from 'node:fs';
const paths = {ardupilot:['hwdef.dat','hwdef-bl.dat','defaults.parm'],px4:['default.px4board','init/rc.board_defaults','init/rc.board_sensors'],betaflight:['config.h']};
const data = Object.fromEntries(Object.entries(paths).map(([target,files])=>[target,Object.fromEntries(files.map(path=>[path,readFileSync(`templates/${target}/${path}`,'utf8').replace(/\r\n/g,'\n')]))]));
writeFileSync('server/templates-data.ts', '/* Private API data. Never import into the frontend. */\nexport const templateData: Record<string, Record<string,string>> = '+JSON.stringify(data,null,2)+';\n');
