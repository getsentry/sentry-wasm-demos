use std::hint::black_box;
use std::sync::Once;
use wasm_bindgen::prelude::*;

static INSTALL_PANIC_HOOK: Once = Once::new();

/// Installed on first divzero / deep-stack crash only (not at wasm load).
fn ensure_panic_hook() {
    INSTALL_PANIC_HOOK.call_once(|| {
        console_error_panic_hook::set_once();
    });
}

/// Runtime div-by-zero (like C++ `volatile int denominator = 0`).
#[inline(never)]
fn crash_divzero(numerator: i32) {
    let denominator = black_box(0);
    let _ = numerator / denominator;
}

#[inline(never)]
fn chaos_deep1() {
    crash_divzero(42);
}

#[inline(never)]
fn chaos_deep2() {
    chaos_deep1();
}

#[inline(never)]
fn chaos_deep3() {
    chaos_deep2();
}

#[inline(never)]
fn chaos_deep4() {
    chaos_deep3();
}

#[inline(never)]
fn chaos_deep5() {
    chaos_deep4();
}

#[wasm_bindgen]
pub fn trigger_crash_divzero() {
    ensure_panic_hook();
    crash_divzero(43);
}

#[wasm_bindgen]
pub fn trigger_crash_deep() {
    ensure_panic_hook();
    chaos_deep5();
}

#[wasm_bindgen]
pub fn ping() -> u32 {
    1
}
