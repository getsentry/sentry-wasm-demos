#include "game.h"

#include <cstdint>

namespace {
Game game;
} // namespace

extern "C" {

void init_game() {
    game.init();
}

void step_game() {
    game.step();
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
