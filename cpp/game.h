#pragma once

#include "maze.h"
#include "raycast.h"

#include <cstdint>

constexpr int SCREEN_WIDTH = 640;
constexpr int SCREEN_HEIGHT = 480;

namespace Keys {
constexpr int W = 87;
constexpr int A = 65;
constexpr int S = 83;
constexpr int D = 68;
constexpr int Left = 37;
constexpr int Up = 38;
constexpr int Right = 39;
constexpr int Down = 40;
} // namespace Keys

class Game {
public:
    Game();
    ~Game();

    void init(int seed);
    void handle_key(int key_code, bool down);
    void step(float dt_ms);
    void render_frame();

    bool has_key() const { return has_key_; }
    bool won() const { return won_; }

    int width() const { return SCREEN_WIDTH; }
    int height() const { return SCREEN_HEIGHT; }
    uint8_t* pixel_buffer() { return pixel_buffer_; }

private:
    bool circle_collides(float x, float y) const;
    void move_with_collision(float dx, float dy);
    void update_pickups_and_win();

    uint8_t* pixel_buffer_;
    Maze maze_;
    Player player_;
    bool keys_down_[256];
    bool has_key_;
    bool won_;
};
