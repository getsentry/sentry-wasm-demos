#include "game.h"

#include <cstdint>

namespace {
Game game;
} // namespace

extern "C" {

void init_game(int seed) {
    game.init(seed);
}

void handle_key(int key_code, int down) {
    game.handle_key(key_code, down != 0);
}

void step_game(float dt_ms) {
    game.step(dt_ms);
}

int player_has_key() {
    return game.has_key() ? 1 : 0;
}

int game_won() {
    return game.won() ? 1 : 0;
}

void render_frame() {
    game.render_frame();
}

int get_width() {
    return game.width();
}

int get_height() {
    return game.height();
}

uint8_t* get_pixel_buffer_ptr() {
    return game.pixel_buffer();
}

} // extern "C"
