#include "game.h"

#include "minimap.h"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <cstring>

namespace {
constexpr int PIXEL_COUNT = SCREEN_WIDTH * SCREEN_HEIGHT * 4;
constexpr float MOVE_SPEED = 2.8f;
constexpr float ROT_SPEED = 2.2f;
constexpr float PLAYER_RADIUS = 0.2f;
} // namespace

Game::Game() : pixel_buffer_(nullptr), maze_(), player_{}, keys_down_{}, has_key_(false), won_(false) {
    std::memset(keys_down_, 0, sizeof(keys_down_));
}

Game::~Game() {
    if (pixel_buffer_ != nullptr) {
        std::free(pixel_buffer_);
        pixel_buffer_ = nullptr;
    }
}

void Game::init(int seed) {
    if (pixel_buffer_ == nullptr) {
        pixel_buffer_ = static_cast<uint8_t*>(std::malloc(PIXEL_COUNT));
    }

    if (pixel_buffer_ != nullptr) {
        std::memset(pixel_buffer_, 0, PIXEL_COUNT);
    }

    std::memset(keys_down_, 0, sizeof(keys_down_));
    has_key_ = false;
    won_ = false;

    maze_.generate(seed);
    player_.x = static_cast<float>(MAZE_START_X) + 0.5f;
    player_.y = static_cast<float>(MAZE_START_Y) + 0.5f;
    player_.angle = 0.0f;

    render_frame();
}

void Game::handle_key(int key_code, bool down) {
    if (key_code < 0 || key_code >= static_cast<int>(sizeof(keys_down_))) {
        return;
    }
    keys_down_[key_code] = down;
}

void Game::step(float dt_ms) {
    if (won_ || pixel_buffer_ == nullptr) {
        return;
    }

    const float dt = dt_ms / 1000.0f;

    if (keys_down_[Keys::Left]) {
        player_.angle -= ROT_SPEED * dt;
    }
    if (keys_down_[Keys::Right]) {
        player_.angle += ROT_SPEED * dt;
    }

    float forward = 0.0f;
    if (keys_down_[Keys::W] || keys_down_[Keys::Up]) {
        forward += 1.0f;
    }
    if (keys_down_[Keys::S] || keys_down_[Keys::Down]) {
        forward -= 1.0f;
    }

    float strafe = 0.0f;
    if (keys_down_[Keys::A]) {
        strafe -= 1.0f;
    }
    if (keys_down_[Keys::D]) {
        strafe += 1.0f;
    }

    if (forward != 0.0f || strafe != 0.0f) {
        const float dx =
            (std::cos(player_.angle) * forward - std::sin(player_.angle) * strafe) * MOVE_SPEED * dt;
        const float dy =
            (std::sin(player_.angle) * forward + std::cos(player_.angle) * strafe) * MOVE_SPEED * dt;
        move_with_collision(dx, dy);
    }

    update_pickups_and_win();
}

bool Game::circle_collides(float px, float py) const {
    const int min_x = static_cast<int>(std::floor(px - PLAYER_RADIUS));
    const int max_x = static_cast<int>(std::floor(px + PLAYER_RADIUS));
    const int min_y = static_cast<int>(std::floor(py - PLAYER_RADIUS));
    const int max_y = static_cast<int>(std::floor(py + PLAYER_RADIUS));

    for (int cy = min_y; cy <= max_y; ++cy) {
        for (int cx = min_x; cx <= max_x; ++cx) {
            if (!maze_.blocks_movement(cx, cy, has_key_)) {
                continue;
            }

            const float closest_x =
                std::max(static_cast<float>(cx), std::min(px, static_cast<float>(cx) + 1.0f));
            const float closest_y =
                std::max(static_cast<float>(cy), std::min(py, static_cast<float>(cy) + 1.0f));
            const float dx = px - closest_x;
            const float dy = py - closest_y;
            if (dx * dx + dy * dy < PLAYER_RADIUS * PLAYER_RADIUS) {
                return true;
            }
        }
    }

    return false;
}

void Game::move_with_collision(float dx, float dy) {
    const float next_x = player_.x + dx;
    const float next_y = player_.y + dy;

    if (!circle_collides(next_x, next_y)) {
        player_.x = next_x;
        player_.y = next_y;
        return;
    }

    if (!circle_collides(next_x, player_.y)) {
        player_.x = next_x;
    } else if (!circle_collides(player_.x, next_y)) {
        player_.y = next_y;
    }
}

void Game::update_pickups_and_win() {
    const int cell_x = static_cast<int>(std::floor(player_.x));
    const int cell_y = static_cast<int>(std::floor(player_.y));
    const uint8_t c = maze_.cell(cell_x, cell_y);

    if (c == CELL_KEY) {
        has_key_ = true;
        maze_.set_cell(cell_x, cell_y, CELL_OPEN);
    }

    if (c == CELL_EXIT) {
        won_ = true;
    }
}

void Game::render_frame() {
    if (pixel_buffer_ == nullptr) {
        return;
    }

    raycast_frame(maze_, player_, has_key_, pixel_buffer_, SCREEN_WIDTH, SCREEN_HEIGHT);
    draw_minimap(maze_, player_, has_key_, pixel_buffer_, SCREEN_WIDTH, SCREEN_HEIGHT);
}
