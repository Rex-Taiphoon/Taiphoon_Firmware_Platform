/*
 * This file is part of Betaflight.
 *
 * Betaflight is free software. You can redistribute this software
 * and/or modify this software under the terms of the GNU General
 * Public License as published by the Free Software Foundation,
 * either version 3 of the License, or (at your option) any later
 * version.
 *
 * Betaflight is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 *
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public
 * License along with this software.
 *
 * If not, see <http://www.gnu.org/licenses/>.
 */

#pragma once

#define FC_TARGET_MCU       STM32H743
#define SYSTEM_HSE_MHZ      8
#define BOARD_NAME          MORAKOT
#define MANUFACTURER_ID     TAIPHOON


//#define USE_CONFIG_TARGET_PREINIT
//一定要不能不定義,但不清楚真實的腳位,疑似SENSORS電源腳位
//#define VDD_3V3_SENSORS1_EN PI11
//一定要不能不定義,但不清楚真實的腳位,疑似SD卡電源腳位
//#define VDD_3V3_SD_CARD_EN  PC13


#define LED0_PIN            PD10
#define LED1_PIN            PD12
#define LED2_PIN            PD13
#define LED_2812B           PD14

//啟動蜂鳴器
#define USE_BEEPER
#define BEEPER_PIN          PD15
//啟動USB檢測功能
#define USE_USB_DETECT
#define USB_DETECT_PIN      PA9

/*
// PINIO Box Config -- VTX Pit Mode
#define PERIPH_12V_EN       PG4
#define PINIO1_PIN          PERIPH_12V_EN
#define PINIO1_CONFIG       129
#define PINIO1_BOX          40
*/


// TODO: useful for...? Suggestions?
// PINIO Box Config -- USER1
// #define MOTOR9_PIN          PD12     // TIM4_CH1
// #define PINIO2_PIN          MOTOR9_PIN
// #define PINIO2_CONFIG       1
// #define PINIO2_BOX          40


// GPS1 UART 配置 GPS 的 UART 通訊功能
#ifndef USE_GPS
#define USE_GPS
#endif
#define UART5_TX_PIN         PB6
#define UART5_RX_PIN         PB5
#define GPS_UART             SERIAL_PORT_UART5

// GPS1 I2C 配置 GPS 的 I2C 通訊功能。
#define I2C1_SCL_PIN         PB8
#define I2C1_SDA_PIN         PB9



// DJI HDL (RX only)配置 DJI HDL（High Definition Link）的 UART 通訊功能,通訊僅用於接收數據
#define UART1_TX_PIN         PB14
#define UART1_RX_PIN         PB15

/*
// Debug 好像沒有用到
#define UART3_TX_PIN         PD8
#define UART3_RX_PIN         PD9
#define MSP_UART             SERIAL_PORT_UART3
*/


// ESC1 Telemetry (RX only)
#define UART7_TX_PIN         PE8
#define UART7_RX_PIN         PE7
#define ESC_SENSOR_UART_1    SERIAL_PORT_UART7

// ESC2 Telemetry (RX only)
#define UART6_TX_PIN         PC6
#define UART6_RX_PIN         PC7
#define ESC_SENSOR_UART_2    SERIAL_PORT_UART6


/*
// VTX 不知道在哪
#define UART5_TX_PIN         PC12
#define UART5_RX_PIN         PD2
#define MSP_DISPLAYPORT_UART SERIAL_PORT_UART5
*/


// RC Input 配置 RC（遙控器）輸入的 UART 通訊。
#define UART8_TX_PIN         PE1
#define UART8_RX_PIN         PE0
#define SERIALRX_UART        SERIAL_PORT_USART8


// UARTX Telem 配置 Telemetry（遙測）功能的 UART 通訊。
#define UART7_TX_PIN         PE8
#define UART7_RX_PIN         PE7
#define UART7_RTS_PIN        PE9
#define UART7_CTS_PIN        PE10

//配置I2C腳位
#define I2C1_SCL_PIN        PB8
#define I2C1_SDA_PIN        PB9
#define USE_I2C_PULLUP

// Baro I2C bus 配置氣壓計（Barometer）的 I2C 通訊。
#define USE_BARO
#define USE_BARO_BMP388
#define BARO_I2C_INSTANCE   I2CDEV_1
//I2C Address
#define DEFAULT_BARO_I2C_ADDRESS 118


// Compass I2C bus 配置電子羅盤（Compass）的 I2C 通訊
#define USE_MAG
#define USE_MAG_LIS2MDL
#define MAG_I2C_INSTANCE    I2CDEV_1
#define DEFAULT_MAG_I2C_ADDRESS 30
//指定電子羅盤的校準方向為順時針旋轉 180 度。
#define MAG_ALIGN           CW180_DEG


// ICM-c on SPI1
//啟用加速度計 (Accelerometer) 的功能。
#define USE_ACC
//啟用陀螺儀 (Gyroscope) 的功能。
#define USE_GYRO
//啟用外部中斷 (External Interrupt)。
#define USE_EXTI
//使用 ICM45686 感測器來提供加速度計和陀螺儀的數據。
#define USE_ACCGYRO_ICM45686
//ROLL 軸旋轉 180 度,YAW 軸旋轉 90 度
#define DEFAULT_ALIGN_BOARD_ROLL 180

//#define USE_SPI 
//#define USE_SPI_DEVICE_1
#define SPI1_SCK_PIN           PA5
#define SPI1_SDI_PIN           PA6
#define SPI1_SDO_PIN           PD7
#define ICM45686_SPI_INSTANCE  SPI1
#define ICM45686_CS_PIN        PA15
#define ICM45686_EXTI_PIN      PD11
#define ICM45686_ALIGN         CW90_DEG_FLIP

#define GYRO_1_SPI_INSTANCE    ICM45686_SPI_INSTANCE
#define GYRO_1_CS_PIN          ICM45686_CS_PIN
//定義陀螺儀的對齊方式為 CW90_DEG_FLIP，表示需要順時針旋轉 90 度並翻轉方向進行校正。
#define GYRO_1_ALIGN           ICM45686_ALIGN

//定義陀螺儀的外部中斷腳位為 PD11  
#define GYRO_1_EXTI_PIN        ICM45686_EXTI_PIN 

// External SPI port (OSD)
#define SPI4_SCK_PIN        PE2
#define SPI4_SDI_PIN        PE5
#define SPI4_SDO_PIN        PE6
#define OSD_CS_PIN          PE4

// SD card 以下設定與 SD 卡相關。  
//表示啟用 SD 卡功能。
#define USE_SDCARD  
//使用 SDIO（Secure Digital Input Output）介面來與 SD 卡通訊。 
#define USE_SDCARD_SDIO
//啟用 SDIO 的上拉電阻，用於穩定信號。 
#define USE_SDIO_PULLUP
//定義 SDIO 的時鐘分頻值為 2
#define SDIO_CLOCK_DIV      2
//表示使用第一個 SDIO 設備
#define SDIO_DEVICE         SDIODEV_1
//使用 4 位寬的數據線模式
#define SDIO_USE_4BIT       1
#define SDIO_CK_PIN         PC12
#define SDIO_CMD_PIN        PD2
#define SDIO_D0_PIN         PC8
#define SDIO_D1_PIN         PC9
#define SDIO_D2_PIN         PC10
#define SDIO_D3_PIN         PC11
//定義預設的 Blackbox 記錄設備為 SD 卡。
#define DEFAULT_BLACKBOX_DEVICE BLACKBOX_DEVICE_SDCARD


// BAT voltage ADC
#define ADC_VBAT_PIN        PC0
#define DEFAULT_VOLTAGE_METER_SOURCE VOLTAGE_METER_ADC
#define DEFAULT_VOLTAGE_METER_SCALE  210 


// BAT current ADC
#define ADC_CURR_PIN        PC2
#define DEFAULT_CURRENT_METER_SOURCE CURRENT_METER_ADC
#define DEFAULT_CURRENT_METER_SCALE  100

/*
// 3V3 ADC
#define ADC_EXTERNAL1_PIN   PA0
// 5V ADC
#define ADC_EXTERNAL2_PIN   PB1
// 12V ADC
#define ADC_EXTERNAL3_PIN   PA4
*/


// Motor configuration
#define USE_TIMER_MAP_PRINT
#define MOTOR1_PIN          PE14    // PE14  : TIM1_CH4
#define MOTOR2_PIN          PE13    // PE13  : TIM1_CH3
#define MOTOR3_PIN          PE11    // PE11  : TIM1_CH2
#define MOTOR4_PIN          PA8     // PA8   : TIM1_CH1
#define MOTOR5_PIN          PA0     // PA0   : TIM2_CH1
#define MOTOR6_PIN          PB3     // PB3   : TIM2_CH2
#define MOTOR7_PIN          PB10    // PB10  : TIM2_CH3
#define MOTOR8_PIN          PA3     // PA3   : TIM2_CH4
#define MOTOR9_PIN          PB0     // PB0   : TIM3_CH3


// TIMER_PIN_MAP(mot_idx, pin, occurance, dma_opt)
// NOTE: dma_opt unnecessary since H7 has dmamux
#define TIMER_PIN_MAPPING \
    TIMER_PIN_MAP(0, MOTOR1_PIN, 1, 0) \
    TIMER_PIN_MAP(1, MOTOR2_PIN, 1, 1) \
    TIMER_PIN_MAP(2, MOTOR3_PIN, 1, 2) \
    TIMER_PIN_MAP(3, MOTOR4_PIN, 1, 3) \
    TIMER_PIN_MAP(4, MOTOR5_PIN, 1, 4) \
    TIMER_PIN_MAP(5, MOTOR6_PIN, 1, 5) \
    TIMER_PIN_MAP(6, MOTOR7_PIN, 1, 6) \
    TIMER_PIN_MAP(7, MOTOR8_PIN, 1, 7) \
    TIMER_PIN_MAP(8, MOTOR9_PIN, 1, 8)


// DMA stream assignment
//#define TIMUP8_DMA_OPT      10
//#define TIMUP5_DMA_OPT      11
#define ADC1_DMA_OPT        8
#define ADC3_DMA_OPT        9
//#define SPI1_TX_DMA_OPT     14
//#define SPI1_RX_DMA_OPT     15


/*
// 啟用CAN功能
#define USE_CAN
// 定義CAN引腳
#define CAN_TX_PIN PD0 // 
#define CAN_RX_PIN PD1 // 
// 定義CAN的硬體設置
#define CAN_PORT GPIOD
#define CAN_AF FDCAN1    // 替換為對應的CAN硬體功能


// 啟用ETH功能
#define USE_ETH

// 定義ETH引腳
#define ETH_MDIO_PIN             PA2
#define ETH_MDC_PIN              PC1
#define ETH_RMII_REF_CLK_PIN     PA1
#define ETH_RMII_CRS_DV_PIN      PA7
#define ETH_RMII_RXD0_PIN        PC4
#define ETH_RMII_RXD1_PIN        PC5
#define ETH_RMII_TX_EN_PIN       PB11
#define ETH_RMII_TXD0_PIN        PB12
#define ETH_RMII_TXD1_PIN        PB13

// 定義ETH的硬體設置
//#define ETH_PORT GPIOA  // 替換為對應的ETH硬體功能
#define ETH_AF ETH      // 替換為對應的ETH硬體功能

*/

// Remaining unmapped signals (no use in betaflight?)
// TODO: 12v pgood   : PE15 --> 12V regulator PGOOD
// TODO: 5v pgood    : PF13 --> 5V regulator PGOOD
// TODO: 5V_ON_BATn  : PG1  --> Diode status signal (5V from USB or 5V from regulator)
// TODO: IMU heater  : PB10 --> TIM2_CH3 for PWM resistor IMU temperature control
