# Morakot 固定來源與工具鏈

核對日期：2026-10-03。完整 SHA 在 shared/catalog.ts，不跟隨分支最新 head。新版每個平台可以選受控 profile；维护方式見 versions.md。模板來自使用者提供的三個 ZIP，僅導入文字配置，原有二進位與壓縮檔不提交到 Git。

| 平台 | 固定來源 | 工具鏈／入口 |
| --- | --- | --- |
| ArduPilot | Rex-Taiphoon/ardupilot@92b0cd788ec29406f26c6f9c31d5ceedbd1cc538 | ardupilot/ardupilot-dev-chibios:v0.2.0，GCC 10.2.1；waf Morakot configure + copter／plane／rover／sub |
| PX4 | Rex-Taiphoon/PX4-Autopilot@186ad6d6914456bdb39f196c3069e9bef995bc3a | 上游 CI 指定 ghcr.io/px4/px4-dev:v1.17.0-rc2；make morakot_v6_default，MinSizeRel／Debug 與 LTO |
| PX4 1.17.0 | PX4/PX4-Autopilot@d6f12ad1c4f70ad3230afd7d86e971421e02fef4 | 官方 v1.17.0 固定來源，templates/px4-1.17；同一經驗證的容器 digest與 make 入口 |
| Betaflight | betaflight/betaflight@1b53ace8356cc43f3c8359ed2357255ba789ca73 | 官方 Arm GNU 13.3.Rel1，make arm_sdk_install + fwo CONFIG=MORAKOT |
| AM32 | Rex-Taiphoon/AM32@eec483e880bc9ac2429dafc71368f044dc018892 | 原 Makefile SDK 安裝；MORAKOT_4IN1_ESC_60A_G071／L431_CAN；G071 已通過 Actions 與 Release 校驗 |
| INAV 9.1.0 | iNavFlight/inav@e519b69b02e27c8bdc03b4a0889f1baaae211a54 | 官方 CMake + ARM GNU 13.2.1；MORAKOT／MORAKOT.bin，templates/inav-9.1.0-r2，見 [移植依據](inav-morakot.md) |

## ArduPilot

附件 hex 內標示 ArduCopter V4.6.3 (92b0cd78)，已解析為上述完整 SHA。此來源沒有 Morakot 板目錄，adapter 以附件 hwdef／hwdef-bl 覆蓋，將 AP_HW_Morakot 映射為已核對的 board ID 1210。先在 Actions 編譯 bootloader 提供 firmware build 需要的檔案，正式下載只包含所選載具的 APJ／BIN，不包含 bootloader。原預設參數由受控 defaults.parm 提供。

舊 schema-1 工作的 OSD 關閉時設定 OSD_ENABLED=0、HAL_WITH_MSP_DISPLAYPORT=0、HAL_WITH_OSD_BITMAP=0、OSD_PARAM_ENABLED=0，避免 4.6.3 DisplayPort 依賴；Lua 由 AP_SCRIPTING_ENABLED 控制。OSD_TYPE2 是額外執行時預設值，不代替編譯開關。新版由 hwdef／defaults.parm 決定 OSD，不提供額外 OSD 表單或覆寫；Lua 選項仍受控。

同一 source 的 Copter／Plane／Rover 是 4.6.3，Sub version.h 是 4.6.0-dev，Release 依載具分別標記。只有實際完成的組合可宣稱已雲端驗收，其餘選項／載具仍須各自編譯與硬體檢查。

## PX4

附件套件包含完整 git_hash，已核對同一固定 source。完整板級文字來源位於 templates/px4，複製至 boards/morakot/v6。保留附件 bootloader board ID 1105 與 image_maxsize 1703936，修正人類名稱為 Morakot；不擅自更改刷寫 ID 或放大容量。

Rex fork 沒有提供 v1.18.0-beta1 tag。流程只從官方 PX4/PX4-Autopilot 取得該 tag，核對 annotated tag object d90ac5b79200c44895c03ee7c284b20b80ecf75d，並驗證 describe 與固定源的祖先關係；不是替换韌體原始碼。韌體版本為 v1.18.0-beta1-6-g186ad6d691。封装與 publish 均驗證完整 git_hash、board ID、解壓映像大小與內嵌版本，防止 v0.0.0 或超出刷寫容量的套件被發布。

Release 使用 MinSizeRel；LTO 預設啟用，DDS 預設停用。開啟 DDS 的實際 LTO 映像為 1,720,524 bytes，仍大於附件 bootloader 套件上限 1,703,936 bytes，因此拒絕發布。DDS 在 px4board 實際切換；新版 OSD 依 px4board 內容，只有舊快照另有表單覆寫。init 編輯限定數值參數與受控驅動 start，不接受通用 shell。

PX4 1.17.0：官方 annotated tag a5eb12d2ab591251faa009f76b2685b8cc64405d 指向 d6f12ad1c4f70ad3230afd7d86e971421e02fef4。Morakot 文字配置獨立保存；已真實編譯，board 1105、內嵌 v1.17.0、完整 source hash及解壓映像 1,597,996 bytes均通過，低於 1,703,936 bytes。這不代表感測器及硬體已驗收。新版 ArduPilot／PX4 的 image 固定 digest，而非追蹤浮動 tag。

## Betaflight

附件標示 2026.12.0-alpha；使用者公開 fork 原先仍為 2025.12.0-beta。原 ZIP 的完整 firmware source SHA 無法確認，因此選用附件日期前一天的官方固定來源（2026-08-23）與附件 config.h/config.c，明確揭露差異，不能宣稱重現附件二進位。

定義獨立放入 work/definition/configs/MORAKOT，Makefile 透過 BETAFLIGHT_CONFIG 載入，不拉動態最新版 config。關閉功能在 common_post.h 最後排除對應 USE_*／ENABLE_*，避免上游 common_pre.h 重新啟用預設功能。原 config.h 中的硬體定義仍受固定 MCU／板名與指令限制。

## AM32、INAV

AM32 adapter 使用已核對的兩種 Morakot ESC 目標，清除 targets.h 顶端預選的其他板，僅修改選中區塊的序列遙測，不改 dead time、ADC／功率參數。G071 已完成編譯、發布與下载雜湊／HEX checksum 核對；L431 CAN 尚未雲端驗收。固定來源 Inc/version.h 已核對 VERSION_MAJOR=2、VERSION_MINOR=20。新版使用 AM32 2.20 命名，另在 provenance 保存來源 SHA；舊 SHA-labelled profile 留作歷史相容。

INAV 尚缺 Morakot target、固定 source SHA 與編譯入口，不以其他 H743 板代替。


## 新增 4.7.0 與 PX4 Bootloader

ArduPilot 4.7.0 固定官方 Copter-4.7.0 commit 1511f27194f1dcc3728270883047bdf022b3fd53；此 commit 各載具版本 header 均為 4.7.0。Morakot 首次移植在 configure 因 HAL_PROBE_EXTERNAL_I2C_COMPASSES 棄用而被拒絕；r2 的獨立模板使用官方規定的 AP_COMPASS_PROBING_ENABLED。4.6.3、4.7.0 r1 原模板保留，失敗工作不建立 Release。

PX4 r3 profile 支援 default／bootloader 兩個白名單目標。Bootloader 沿用各版固定原始碼、容器及板級模板，輸出 BIN／ELF；以 ARM ELF load segments 與 BIN bytes 核對、驗證 128 KiB 容量及 Flash 起點。NuttX 初始 SP 為 _ebss + CONFIG_IDLETHREAD_STACKSIZE，附件 idle stack 為 750 bytes，實際 SP 未對齊而被檢查拒絕；r3 模板將 idle／init stack 改為 768／3200 bytes、linker _ebss 改為 8-byte 對齊。產物檢查要求 8-byte 對齊，並限定有效 SRAM 區間與 Thumb Reset 位址。

參考：[官方 Copter-4.7.0](https://github.com/ArduPilot/ardupilot/releases/tag/Copter-4.7.0)、[官方 PX4 Bootloader 建置／刷寫](https://docs.px4.io/main/en/advanced_config/bootloader_update)、[固定 NuttX 向量表](https://github.com/PX4/NuttX/blob/fb2fadf6f599c1406f052db013efd00a2518e72c/arch/arm/src/armv7-m/arm_vectors.c)。


## 近期官方 Release 來源（2026-10-04 核對）

新工作依選定原平台版本 checkout 對應完整 commit，才套用 Morakot 配置。AM32 各版模板保留官方 targets.h 全文，只加入兩組 Morakot 條件定義；其 Makefile 從 FILE_NAME 自動取得編譯目標，不把舊 fork 的整份 header 覆蓋到新版。

| 平台／原 tag | Repository | 固定來源 commit |
| --- | --- | --- |
| px4 / v1.18.0-rc1 | PX4/PX4-Autopilot | fca3df865af36124a28c9d607e850f111dbaaea9 |
| px4 / v1.18.0-beta2 | PX4/PX4-Autopilot | 83c4f4e580558816f0e398918f66358988004696 |
| ardupilot / Copter-4.7.1 | ArduPilot/ardupilot | dbe792162d06cab66c3475fd5556bf7a120f119e |
| betaflight / 2026.6.2 | betaflight/betaflight | e0b7bb01b17b21351057e9ead2d1ab39dd44fa16 |
| betaflight / 2026.6.1 | betaflight/betaflight | 6dbc4218fd6bc33bf16ea32c670304d4f89321d5 |
| am32 / v2.21 | am32-firmware/AM32 | 6b3ef3d15228e8d70244bd6e3bd87c7eac939d6f |
| am32 / v2.20 | am32-firmware/AM32 | 7859b1f5200293fcedb382055600c2ee0fd7f557 |
| px4 / v1.18.0-beta1 | PX4/PX4-Autopilot | fd132028513748238be1762e57893bbca9fcf179 |

既有 beta fork 的 186ad6d691 在官方 beta1 之後還有 6 個 commit，包括功能變更；新的 beta1 選項改用官方 tag commit，舊快照／Release 仍依原來源核對。ArduPilot 4.6.3 的 92b0cd788ec29406f26c6f9c31d5ceedbd1cc538 已另外確認等於官方 Copter-4.6.3 tag 的 commit。
