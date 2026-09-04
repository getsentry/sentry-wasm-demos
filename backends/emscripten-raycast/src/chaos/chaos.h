#pragma once

void chaos_deep1();
void chaos_deep2();
void chaos_deep3();
void chaos_deep4();
void chaos_deep5();

/** Immediate trap — worker crash button still calls these. */
extern "C" void trigger_crash_divzero();
extern "C" void trigger_crash_deep();

/** Arm only — trap runs at the start of the next step_game(). */
extern "C" void arm_crash_divzero();
extern "C" void arm_crash_deep();

void run_pending_crash();
