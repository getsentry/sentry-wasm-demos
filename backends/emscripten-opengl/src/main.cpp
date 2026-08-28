#include "game.h"

#include "gl_minimap.h"
#include "gl_render.h"

#include <cstdint>

namespace {
Game game;
bool gl_initialized = false;
} // namespace

extern "C" {

void init_game(int seed, int level) {
    if (!gl_initialized) {
        gl_render_init();
        gl_minimap_init();
        gl_initialized = true;
    }
    game.init(seed, level);
}

void handle_key(int key_code, int down) {
    game.handle_key(key_code, down != 0);
}

void step_game(float dt_ms) {
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

} // extern "C"
