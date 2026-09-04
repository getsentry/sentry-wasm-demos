#pragma once

void chaos_deep1();
void chaos_deep2();
void chaos_deep3();
void chaos_deep4();
void chaos_deep5();

/** Immediate trap — called from run_pending_crash(), not exported to JS. */
void trigger_crash_divzero();
void trigger_crash_deep();

/** Arm only — trap runs at the start of the next step_game(). */
extern "C" void arm_crash_divzero();
extern "C" void arm_crash_deep();

void run_pending_crash();
