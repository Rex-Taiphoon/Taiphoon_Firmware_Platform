# 多硬體與硬體版本

操作順序為硬體型號 → 硬體版本 → 相容韌體 → 韌體版本 → 配置 → 編譯。硬體識別由受控 profile 決定，使用者不能自行輸入板名、來源、編譯命令或 MCU。保存及恢復工作都依同一 profile 載入正確的硬體與配置。

| 硬體 | 韌體 | 板級入口 | 配置來源 |
| --- | --- | --- | --- |
| Morakot Ver.1 | ArduPilot、PX4、Betaflight、INAV | 保留既有入口 | 原有模板 |
| Morakot 4-in-1 ESC | AM32 | 保留 G071／L431 CAN 選項 | 原有模板 |
| NariGPS Ver.1 | ArduPilot AP_Periph 1.9.0-dev | Taiphoon_Nari，STM32F469 | Nari_GPS_260716_V1.32.zip |
| HerbNode Ver.1 | ArduPilot AP_Periph 1.9.0-dev | Taiphoon_Herb，STM32H757 | Herb_260716_V1.1.zip |
| Morakot Ver.2 | 待板級定義 | 未註冊編譯 profile，介面停用 | 尚未提供 |

使用者已確認目前硬體分別為 Morakot Ver.1、NariGPS Ver.1、HerbNode Ver.1；另有 Morakot Ver.2 待接入。附件的 V1.32／V1.1 保留為附件配置標籤，不作為硬體或 AP_Periph 韌體版本。內部 revision ID `current` 對應上述 Ver.1，保留此 ID 以維持配置快照、profileDigest 與既有 Release 的相容性。新硬體版本須新增 revision 與 profile，不覆寫現有配置。

## AP_Periph 附件查核

Nari HEX 中的 `AP_Periph V1.9.0-dev (d36256f8)` 已解析為官方 [d36256f87d135de0d5f40bcd0930f5f26431228a](https://github.com/ArduPilot/ardupilot/commit/d36256f87d135de0d5f40bcd0930f5f26431228a)。Herb HEX 中的 `AP_Periph V1.9.0-dev (140d0070)` 已解析為官方 [140d0070276c6c203ab851ccf16af7c096fcbb92](https://github.com/ArduPilot/ardupilot/commit/140d0070276c6c203ab851ccf16af7c096fcbb92)。各 commit 的 Tools/AP_Periph/version.h 均已核對為 1.9.0-dev。這是來源識別查核，不代表已證明附件二進位可逐位元重現。

兩份 hwdef／hwdef-bl 都保留附件內容。Herb ZIP 目錄的日期前綴不作為 waf 板名；使用附件 HEX 的 Taiphoon_Herb 身分。HEX 僅用於研究，沒有加入模板或當成新編譯產物。

附件 SHA256：

- Nari_GPS_260716_V1.32.zip：`52029f5cbb4b94623e11de9558ce82035151277cdb5f97d38a7f412c3dba62f3`
- Herb_260716_V1.1.zip：`88219b2b555d509b668aa05045e0abdb13a6960edb0b6ea32c195c3d76a6d3b9`

兩塊板的 board ID 都是附件指定的 12345。APJ／BIN 除了來源、容量與 board ID，還核對映像中的 CAN 節點名：Nari 為 org.Taiphoon.Nari，Herb 為 Taiphoon.Herb。不能單憑相同 board ID 判斷這兩塊板可互刷。

Nari 主韌體保留起點 64 KiB（0x08010000），Herb 為 256 KiB（0x08040000），Flash 都是 2048 KiB。這些值、storage page、儲存大小、MCU、board ID、AP_PERIPH 模式與 CAN 節點名不可透過編輯器變更或重複覆寫。

Herb bootloader 僅允許原本的 `include ../include/network_bootloader.inc`，該檔来自選定的固定官方來源。兩板僅允許 `env AP_PERIPH 1`；其他 include、env、ROMFS 指令維持拒絕。

編譯使用 `waf configure --board <已登錄板名>`、`waf AP_Periph`，先編譯同板 bootloader 供官方流程嵌入。平台發布主韌體 APJ／BIN；目前沒有發布附件形式的 `AP_Periph_with_bl.hex`。BIN 是主韌體，不能當作從 0x08000000 起始的完整 bootloader 映像。

## 新增硬體

1. 在 shared/hardware.ts 登錄產品與硬體 revision。不要把韌體版本或模板修訂當作硬體版本。
2. 將經檢查的板級文字配置加入獨立 templates/<templateKey> 目錄，執行 `node scripts/template-data.mjs` 產生私人模板、檔案白名單與模板雜湊。
3. 在 shared/catalog.ts 新增不可變的 profile，指定 hardware、韌體種類、版本、完整來源 SHA、模板、工具鏈及支援的 recipeRefs。同一產品的不同 revision 使用不同 profile。
4. ArduPilot profile 指定 ardupilotBoard：waf 板名、MCU、board ID、容量上限、受保護 hwdef 指令、允許的 include、產物名稱與映像識別。AP_Periph 不繼承飛控的 Copter／Plane／Lua 選項。
5. 其他韌體框架新增板子時，須同時擴充該框架 adapter、配置政策及套件檢查。目前 PX4／Betaflight／INAV／AM32 的板級規則仍是現有 Morakot；不能僅新增名稱就宣稱新硬體可編譯。
6. 檢查錯板配置、錯誤 MCU／board ID、Flash 上限、產物識別、配置快照及舊工作相容性，再做 GitHub Actions 編譯與實機验收。

既有 profile 不補寫 hardware 欄位，以保留舊 profileDigest、配置 JSON 與 Release 標籤。舊飛控 profile 對應 Morakot/current，舊 AM32 對應 morakot-esc/current。新 profile 的硬體與板級規則納入 profileDigest，新 Release／provenance 帶硬體識別與 revision。

## 部署與驗收狀態

2026-10-05 已完成正式部署：私人平台 commit 為 `3879df6fee14e9a7ca6d1e055ac1b4a827627fbe`，公開前端 commit 為 `fcf515b85be062d97ec161e785857a280f935c24`。GitHub Pages [部署工作](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Pages/actions/runs/37258642991) 成功，正式網頁 HTTP 200，線上 JavaScript SHA256 與本機正式建置一致，所有硬體版本名稱已核對。Cloudflare Worker 部署版本為 `2d604ca2-9f58-4e8b-a2a1-b1dff261d5fc`，未登入讀取私人模板仍回應 401。

新 AP_Periph profiles 限定 `platform-build-v2-14`，已建立固定 tag 並將正式 API 的 GITHUB_WORKFLOW_REF 切換至該版本。舊流程仍會明確拒絕新硬體工作，避免把新 profile 送到不認識它的舊 recipe。

65 項本機自動測試、型別檢查、前端／API 建置與公開資產邊界審核通過。另已送出 publish_release=false 的雲端驗證：[NariGPS](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37258583884)、[HerbNode](https://github.com/Rex-Taiphoon/Taiphoon_Firmware_Platform/actions/runs/37258587205)。部署核對時兩工作都通過 validate，build 尚在執行；未發布這兩板的驗證韌體，也尚未進行實機驗收。

後續更新仍须先提交完整 recipe、建立不可變 tag，再部署對應 API／前端。舊 tag 必須保留；若韌體編譯失敗，新增修訂 profile／recipe，保留原追溯資訊。
