#include "game.h"
#include "chaos/chaos.h"

#include <cstdint>

namespace {
Game game;
} // namespace

extern "C" {

void init_game(int seed, int level) {
    game.init(seed, level);
}

void handle_key(int key_code, int down) {
    game.handle_key(key_code, down != 0);
}

void step_game(float dt_ms) {
    run_pending_crash();
    game.step(dt_ms);
}

int player_key_count() {
    return game.keys_collected();
}

int keys_required() {
    return game.keys_required();
}

int game_won() {
    return game.won() ? 1 : 0;
}

int get_level() {
    return game.level();
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
