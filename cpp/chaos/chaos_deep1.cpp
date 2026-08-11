#include "chaos.h"

void chaos_deep1() {
    volatile int numerator = 42;
    volatile int denominator = 0;
    volatile int result = numerator / denominator;
    (void)result;
}
