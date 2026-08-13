use std::hint::black_box;
use wasm_bindgen::prelude::*;

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
    crash_divzero(43);
}

#[wasm_bindgen]
pub fn trigger_crash_deep() {
    chaos_deep5();
}

#[wasm_bindgen]
pub fn ping() -> u32 {
    1
}
