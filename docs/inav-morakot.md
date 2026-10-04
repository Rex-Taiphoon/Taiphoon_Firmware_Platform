# Morakot INAV 9.1.0 移植

基底是官方 [iNavFlight/inav 9.1.0](https://github.com/iNavFlight/inav/releases/tag/9.1.0)，固定 commit `e519b69b02e27c8bdc03b4a0889f1baaae211a54`。只新增 `src/main/target/MORAKOT/` 板級目錄，不修改 INAV 感測器驅動；不是 INAV 官方收錄板子。完整預設模板存於 `templates/inav-9.1.0/`，包含 CMakeLists.txt、target.h、target.c、config.c、hardware_setup.c，Pages 可逐檔編輯。各次保存的完整檔案位於 requests 快照，編譯與 Release 使用同一快照。

## 腳位依據

對照附件移植的 ArduPilot `templates/ardupilot-4.7.1/hwdef.dat` 與 PX4 `templates/px4-1.18-rc1/`；Betaflight 配置僅作第三份交叉比對。未取得原理圖，以下是配置推導，實際 PCB 仍須驗收。

| 硬體 | INAV 設定 | 依據／差異 |
| --- | --- | --- |
| MCU／晶振 | STM32H743、2 MiB、8 MHz | 兩平台一致 |
| ICM45686 | SPI1 PA5／PA6／PD7，CS PA15，DRDY PD11 | ArduPilot CS 與 PX4 SPI 描述一致；PD11 取 PX4 |
| IMU 方向 | CW90_DEG_FLIP | 採 ArduPilot ROLL_180_YAW_90，與 INAV `(y,x,-z)` 變換相符；PX4 指令實際使用 -R 2（Yaw90），與其註解不一致。不另加 board roll |
| BMP388 | I2C1 PB8／PB9，0x76 | 兩平台一致；INAV 既有驅動 |
| 指南針 | I2C1 支援官方已提供的外接 MAG 驅動 | 板載 IIS2MDC 沒有 INAV 9.1.0 驅動，沒有假裝以 LIS3MDL 替代；內建指南針不支援。RM3100 的本版既有驅動為 SPI，沒有宣稱支援 ArduPilot 的 I2C RM3100 |
| UART | UART1 PB14/15、UART2 PD5/6、UART3 PD8/9、UART5 PB6/5、UART6 PC6/7、UART7 PE8/7、UART8 PE1/0 | 兩平台一致；7 個 UART + USB，未虛構 UART4 |
| 預設 RX／GPS | CRSF UART8、GPS UART5 115200 | 接收器協定可改 target.h；UART3 的 SBUS 腳位保留，未預設成同時啟用兩個 RX。GPS baud 需符合實際設備 |
| SDMMC1 | PC8–12、PD2，4-bit SD 卡 Blackbox | 兩平台一致；INAV SDIODEV_1 固定腳位 |
| 電壓／電流 | ADC1 PC0 電壓、PC2 電流 | 採 ArduPilot 與 Betaflight 一致的標示；PX4 標示反向。初始 scale=210／100 取附件 Betaflight，需用電表及實際電流校正 |
| 輸出 S1–S9 | PE14、PE13、PE11、PA8、PA0、PB3、PB10、PA3、PB0 | 兩平台 PWM 順序一致，TIM1/TIM2/TIM3；使用 INAV output auto、DSHOT，不預設載具 mixer |
| OSD／蜂鳴器 | SPI4 PE2/5/6、CS PE4；蜂鳴器 PD15 | ArduPilot 與 PX4 腳位；INAV MAX7456 相容驅動，蜂鳴器採 GPIO，未沿用 PX4 不一致的 TIM17 註解 |
| 電源／相機 | PB2 感測器電源 high；PE3 VTX 電源 high；PC13 camera low | PX4 board_config.h 與初始化預設；於感測器偵測前設定 |
| 指示燈 | PD10、PD12、PD13 | 兩平台腳位一致，顏色命名不一致；不宣稱已確認 RGB 顏色 |

CAN、Ethernet 沒有接入本次 INAV 配置；PD0/PD1/PD4 及 Ethernet 腳位沒有另作 PWM／UART。未接入未確認的 RGB 燈條腳位，也未將 PA0 同時當 ADC 與 S5。

## 編譯與發布

專用 `.github/workflows/inav.yml` 與其他平台使用相同保存／核對／發布流程。build job 只有 Contents read；編譯器不持有 API／GitHub 發布 token。上游 CMake 下載並核對其指定的 ARM GNU 13.2.Rel1 工具鏈；流程核對 gcc 13.2.1、官方 tag 與來源 SHA。

GitHub runner 安裝 Ninja／Ruby，執行 `cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release -DWARNINGS_AS_ERRORS=ON`，再建置 `MORAKOT` 與 `MORAKOT.bin`。Debug 可選；兩種模式不會變更板子或原平台版本。發布前核對 HEX checksum、HEX／BIN 一致性、ARM 向量、Flash 範圍、板名、版本及來源。結果使用 `INAV-9.1.0-Morakot-日期-流水號.hex/.bin` 命名，附 config.json、changes.json、provenance.json。

## 刷寫與實機驗收

本版使用官方 INAV H743 原生 linker，Flash 起點 **0x08000000**。它不是起點 0x08020000 的 PX4／ArduPilot application，也不是 .px4／.apj 套件。透過 STM32 ROM DFU 或 SWD 安裝會覆蓋原 PX4／ArduPilot bootloader；要恢復原平台，需重新安裝該平台 bootloader。BIN 起始位址必須指定正確，HEX 已含位址。本次只做雲端編譯與套件核對，沒有刷寫。

驗收時先拆除螺旋槳，核對 USB、感測器供電、IMU 三軸方向、BMP388、外接指南針、各 UART、SD 卡、電壓電流校正與 S1–S9 順序；再測試 PWM／DShot、蜂鳴器與 OSD。雲端編譯通過不代表感測器方向、板子電路或飛行安全已驗證。
