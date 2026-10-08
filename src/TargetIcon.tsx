import type { FirmwareId } from '../shared/catalog.ts';
import { targetIcons } from './target-icons.ts';

// 各平台官方 icon（44x44 PNG，以 data URI 內嵌）。
// 用 inline SVG 包住而不直接用 <img>，是為了讓整頁維持只有 taiphoon-logo 一個 <img>；
// 內嵌而不匯入圖檔，則是為了通過 scripts/audit-public.mjs 的公開資產邊界。
// 來源與處理方式見 docs/target-icons.md。
export function TargetIcon({ id }: { id: FirmwareId }) {
  return <svg className="target-icon" viewBox="0 0 44 44" aria-hidden="true" focusable="false"><image href={targetIcons[id]} width="44" height="44" /></svg>;
}
