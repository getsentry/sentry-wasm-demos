#pragma once

#include <cstdint>

constexpr int SCREEN_WIDTH = 640;
constexpr int SCREEN_HEIGHT = 480;

class Game {
public:
    Game();
    ~Game();

    void init();
    void step();

    int width() const { return SCREEN_WIDTH; }
    int height() const { return SCREEN_HEIGHT; }
    uint8_t* pixel_buffer() { return pixel_buffer_; }

private:
    uint8_t* pixel_buffer_;
    int frame_;
};
