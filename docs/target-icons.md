# 平台 icon 來源與處理

韌體選擇卡片的五個平台 icon 內嵌於 [src/target-icons.ts](../src/target-icons.ts)（由工具產生的 44×44 PNG data URI）。
這裡記錄來源、處理方式與需要注意的權利問題。

## 來源

| 平台 | 來源 URL | 原始規格 |
| --- | --- | --- |
| ArduPilot | `https://firmware.ardupilot.org/Tools/Logos/icon.jpg` | 96×96，**CMYK** JPEG |
| PX4 | `https://raw.githubusercontent.com/PX4/PX4-graphics/master/PX4_Favicon_RGB.png` | PNG |
| Betaflight | `https://raw.githubusercontent.com/betaflight/betaflight-configurator/master/src/images/bf_icon_128.png` | 128×128 PNG |
| INAV | `https://raw.githubusercontent.com/iNavFlight/inav-configurator/master/resources/public/inav_icon_128.png` | 128×128 PNG |
| AM32 | `https://raw.githubusercontent.com/am32-firmware/am32-configurator/master/public/assets/images/192x192.png` | 192×192 PNG，白色透明 |

各專案的橫式字標（例如 `bf_logo.svg`、`PX4_Logo_Black_RGB.svg`、`ArduPilot-Cleaned-Transparent.png`）
在 22px 下會糊掉，因此不使用；改採各專案的方形 app icon／favicon。

## 處理方式

1. 下載來源檔。
2. ArduPilot 的來源是 **CMYK** JPEG，必須先轉 sRGB，否則 librsvg 等 SVG 渲染器會解成空白。
3. 全部縮放為 44×44（22px 顯示的 2 倍）。
4. 統一套用 `rx=10` 圓角遮罩：官方資產方角與圓角混雜，套上同一遮罩後五個才一致。
5. **AM32 是唯一經過重組的圖示**：官方資產是白色透明圖，放在白色卡片上完全看不見，
   因此置於 `#1d1d1f` 深色圓角徽章上，與其他四個的視覺一致。這是本站的處理，不是官方原圖。
6. 以 `data:image/png;base64,` 內嵌。

## 為什麼要內嵌，而不是放圖檔

[scripts/audit-public.mjs](../scripts/audit-public.mjs) 的公開資產邊界只允許 `dist` 出現
`assets/*.js`、`assets/*.css`、`index.html` 與 `taiphoon-logo.png`。
匯入任何圖檔都會讓 Vite 輸出 `dist/assets/*.png`，被這道審核擋下。
內嵌成 data URI 後，圖示隨 JS/CSS 一起打包，公開資產邊界不需要放寬。

同理，用 inline `<svg>` 包住而不直接用 `<img>`，是為了讓整頁維持只有 `taiphoon-logo.png` 一個 `<img>`
（[tests/interface.test.ts](../tests/interface.test.ts) 的斷言）。

## 權利注意事項

這些標誌屬各專案或其基金會的**商標**，與其程式碼授權（多為 GPL／BSD）是分開的。
本平台以「指明所支援的韌體」的方式使用，並在卡片上同時顯示平台名稱文字。
若要把前端公開發布或作商業使用，建議先確認各專案的商標使用條款，例如
[ArduPilot trademark policy](https://github.com/ArduPilot/ardupilot_wiki/blob/master/dev/source/docs/trademark.rst)。

## 重新產生

處理步驟需要影像工具（本專案未把 `sharp` 列為相依，當時借用 pnpm store 內的 `sharp`）。
若要重做：依上表下載來源，照「處理方式」1–6 步驟產生，覆寫 `src/target-icons.ts` 的 data URI 即可；
元件與樣式不需要更動。
