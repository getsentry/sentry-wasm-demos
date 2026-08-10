#include "game.h"

#include "maze.h"
#include "raycast.h"

#include <cmath>
#include <cstdlib>
#include <cstring>

namespace {
constexpr int PIXEL_COUNT = SCREEN_WIDTH * SCREEN_HEIGHT * 4;
} // namespace

Game::Game() : pixel_buffer_(nullptr), frame_(0) {}

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

    frame_ = 0;
    step();
}

void Game::step() {
    if (pixel_buffer_ == nullptr) {
        return;
    }

    static Maze maze;
    static bool maze_ready = false;
    if (!maze_ready) {
        maze.generate();
        maze_ready = true;
    }

    Player player{};
    player.x = 1.5f;
    player.y = 1.5f;
    player.angle = static_cast<float>(frame_) * 0.01f;

    raycast_frame(maze, player, pixel_buffer_, SCREEN_WIDTH, SCREEN_HEIGHT);

    // Stub motion cue: pulsing bar at the top so step_game visibly changes frames.
    const uint8_t pulse = static_cast<uint8_t>(128 + 127 * std::sin(frame_ * 0.08f));
    for (int x = 0; x < SCREEN_WIDTH; ++x) {
        const int idx = x * 4;
        pixel_buffer_[idx + 0] = pulse;
        pixel_buffer_[idx + 1] = 64;
        pixel_buffer_[idx + 2] = 192;
        pixel_buffer_[idx + 3] = 255;
    }

    ++frame_;
}
