/* Taiphoon Morakot board overlay for INAV 9.1.0. SPDX-License-Identifier: GPL-3.0-or-later */
#include <stdint.h>
#include "platform.h"
#include "drivers/bus.h"
#include "drivers/io.h"
#include "drivers/pwm_mapping.h"
#include "drivers/timer.h"
#include "drivers/sensor.h"

BUSDEV_REGISTER_SPI_TAG(busdev_morakot_icm45686, DEVHW_ICM45686, ICM45686_SPI_BUS, ICM45686_CS_PIN, ICM45686_EXTI_PIN, 0, DEVFLAGS_NONE, IMU_ICM45686_ALIGN);

// Preserve the physical S1-S9 order from both supplied Morakot flight-controller definitions.
timerHardware_t timerHardware[] = {
    DEF_TIM(TIM1, CH4, PE14, TIM_USE_OUTPUT_AUTO, 0, 0),
    DEF_TIM(TIM1, CH3, PE13, TIM_USE_OUTPUT_AUTO, 0, 1),
    DEF_TIM(TIM1, CH2, PE11, TIM_USE_OUTPUT_AUTO, 0, 2),
    DEF_TIM(TIM1, CH1, PA8,  TIM_USE_OUTPUT_AUTO, 0, 3),
    DEF_TIM(TIM2, CH1, PA0,  TIM_USE_OUTPUT_AUTO, 0, 4),
    DEF_TIM(TIM2, CH2, PB3,  TIM_USE_OUTPUT_AUTO, 0, 5),
    DEF_TIM(TIM2, CH3, PB10, TIM_USE_OUTPUT_AUTO, 0, 6),
    DEF_TIM(TIM2, CH4, PA3,  TIM_USE_OUTPUT_AUTO, 0, 7),
    DEF_TIM(TIM3, CH3, PB0,  TIM_USE_OUTPUT_AUTO, 0, 8),
};
const int timerHardwareCount = sizeof(timerHardware) / sizeof(timerHardware[0]);
