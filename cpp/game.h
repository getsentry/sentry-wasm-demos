#pragma once

#include "maze.h"
#include "raycast.h"

#include <cstdint>

constexpr int SCREEN_WIDTH = 640;
constexpr int SCREEN_HEIGHT = 480;

class Game {
public:
    Game();
    ~Game();

    void init();
    void render_frame();

    int width() const { return SCREEN_WIDTH; }
    int height() const { return SCREEN_HEIGHT; }
    uint8_t* pixel_buffer() { return pixel_buffer_; }

private:
    uint8_t* pixel_buffer_;
    Maze maze_;
    Player player_;
};
