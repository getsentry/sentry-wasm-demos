#include "chaos.h"

namespace {

void divide_by_zero() {
    volatile int numerator = 42;
    volatile int denominator = 0;
    volatile int result = numerator / denominator;
    (void)result;
}

} // namespace

extern "C" void trigger_crash_divzero() {
    divide_by_zero();
}
