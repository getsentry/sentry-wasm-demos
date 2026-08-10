#include "game.h"

#include <cstdlib>
#include <cstring>

namespace {
constexpr int PIXEL_COUNT = SCREEN_WIDTH * SCREEN_HEIGHT * 4;
} // namespace

Game::Game() : pixel_buffer_(nullptr), maze_(), player_{} {}

Game::~Game() {
    if (pixel_buffer_ != nullptr) {
        std::free(pixel_buffer_);
        pixel_buffer_ = nullptr;
    }
}

void Game::init() {
    if (pixel_buffer_ == nullptr) {
        pixel_buffer_ = static_cast<uint8_t*>(std::malloc(PIXEL_COUNT));
    }

    if (pixel_buffer_ != nullptr) {
        std::memset(pixel_buffer_, 0, PIXEL_COUNT);
    }

    maze_.generate();
    player_.x = static_cast<float>(MAZE_START_X) + 0.5f;
    player_.y = static_cast<float>(MAZE_START_Y) + 0.5f;
    player_.angle = 0.0f;

    render_frame();
}

void Game::render_frame() {
    if (pixel_buffer_ == nullptr) {
        return;
    }

    raycast_frame(maze_, player_, pixel_buffer_, SCREEN_WIDTH, SCREEN_HEIGHT);
}
