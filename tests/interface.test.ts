import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {defaultProfileId} from '../shared/catalog.ts';

test('正式介面提供版本選擇，顯示乾淨版本名稱，不含 OSD 控制或 Morakot 示意圖',async()=>{
  const directory=resolve('.research/ui-test-'+randomUUID());mkdirSync(directory,{recursive:true});
  try{
    const file=join(directory,'interface.mjs');
    await build({stdin:{contents:"export {App} from './src/App.tsx'; export {VersionSelect} from './src/VersionSelect.tsx';",resolveDir:process.cwd(),loader:'tsx'},outfile:file,bundle:true,platform:'node',format:'esm',packages:'external',define:{'import.meta.env.DEV':'false','import.meta.env.VITE_API_URL':'"https://api.example.com"','import.meta.env.BASE_URL':'"/"'},logLevel:'silent'});
    const {App,VersionSelect}=await import(pathToFileURL(file).href);
    const prior=Object.getOwnPropertyDescriptor(globalThis,'location');Object.defineProperty(globalThis,'location',{value:{search:''},configurable:true});
    try{
      const html=renderToStaticMarkup(createElement(App));
      assert.match(html,/aria-label="韌體版本"/);assert.ok(!html.includes('hero-detail'));assert.ok(!html.includes('class="orbit"'));assert.ok(!html.includes('編譯 OSD'));assert.ok(!html.includes('第二組 OSD'));
      assert.match(html,/aria-label="硬體型號"/);assert.match(html,/aria-label="硬體版本"/);
      assert.match(html,/>NariGPS<\/option>/);assert.match(html,/>HerbNode<\/option>/);
      assert.match(html,/>Morakot Ver\.1<\/option>/);
      assert.match(html,/<option value="v2" disabled="">Morakot Ver\.2 · 待提供板級定義<\/option>/);
      assert.equal((html.match(/<img /g)||[]).length,1);assert.match(html,/taiphoon-logo.png/);
      const px4=renderToStaticMarkup(createElement(VersionSelect,{target:'px4',selected:defaultProfileId('px4'),disabled:false,onSelect:()=>{}}));
      assert.match(px4,/1\.17\.0/);assert.match(px4,/1\.18\.0-beta1/);assert.ok(!px4.includes('-6-g186ad6d691 ·'));assert.match(px4,/1\.18\.0-rc1/);assert.ok(!/>[^<]* · r[123]/.test(px4));
      const am32=renderToStaticMarkup(createElement(VersionSelect,{target:'am32',selected:defaultProfileId('am32'),disabled:false,onSelect:()=>{}}));assert.match(am32,/2\.20/);assert.ok(!am32.includes('eec483e880bc'));
      const inav=renderToStaticMarkup(createElement(VersionSelect,{target:'inav',selected:defaultProfileId('inav'),disabled:false,onSelect:()=>{}}));
      assert.match(inav,/>9\.1\.0<\/option>/);assert.ok(!/>[^<]*morakot-r[12]/i.test(inav));
      for(const id of ['narigps','herb-node']){
        const periph=renderToStaticMarkup(createElement(VersionSelect,{target:'ardupilot',selected:defaultProfileId('ardupilot',{id,revision:'current'}),disabled:false,onSelect:()=>{}}));
        assert.match(periph,/>1\.9\.0-dev<\/option>/);assert.ok(!periph.includes('4.7.1'));
      }
    }finally{if(prior)Object.defineProperty(globalThis,'location',prior);else Reflect.deleteProperty(globalThis,'location');}
  }finally{rmSync(directory,{recursive:true,force:true});}
});
