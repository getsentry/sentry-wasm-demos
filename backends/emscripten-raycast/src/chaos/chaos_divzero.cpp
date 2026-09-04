#include "chaos.h"

namespace {
// build v2 — symbols intentionally not uploaded
void divide_by_zero() {
    volatile int numerator = 43;
    volatile int denominator = 0;
    volatile int result = numerator / denominator;
    (void)result;
}

} // namespace

void trigger_crash_divzero() {
    divide_by_zero();
}
