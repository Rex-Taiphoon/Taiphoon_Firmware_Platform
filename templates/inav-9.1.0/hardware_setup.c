/* Taiphoon Morakot board overlay for INAV 9.1.0. SPDX-License-Identifier: GPL-3.0-or-later */
#include <stdbool.h>
#include <stdint.h>
#include "platform.h"
#include "drivers/io.h"
#include "drivers/io_impl.h"
#include "drivers/time.h"

void initialisePreBootHardware(void)
{
    // Match PX4 sensor rail enable, VTX power enable and camera-select defaults.
    IOInit(DEFIO_IO(PB2), OWNER_SYSTEM, RESOURCE_OUTPUT, 0);
    IOConfigGPIO(DEFIO_IO(PB2), IOCFG_OUT_PP);
    IOHi(DEFIO_IO(PB2));
    IOInit(DEFIO_IO(PE3), OWNER_SYSTEM, RESOURCE_OUTPUT, 1);
    IOConfigGPIO(DEFIO_IO(PE3), IOCFG_OUT_PP);
    IOHi(DEFIO_IO(PE3));
    IOInit(DEFIO_IO(PC13), OWNER_SYSTEM, RESOURCE_OUTPUT, 2);
    IOConfigGPIO(DEFIO_IO(PC13), IOCFG_OUT_PP);
    IOLo(DEFIO_IO(PC13));
    delay(10);
}
