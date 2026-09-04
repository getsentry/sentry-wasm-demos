#include "chaos.h"

namespace {

enum PendingCrash { None, Divzero, Deep };

PendingCrash pending_crash = None;

} // namespace

extern "C" void trigger_crash_deep() {
    chaos_deep5();
}

extern "C" void arm_crash_divzero() {
    pending_crash = Divzero;
}

extern "C" void arm_crash_deep() {
    pending_crash = Deep;
}

void run_pending_crash() {
    const PendingCrash next = pending_crash;
    pending_crash = None;
    if (next == Divzero) {
        trigger_crash_divzero();
    } else if (next == Deep) {
        trigger_crash_deep();
    }
}
