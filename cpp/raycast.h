#pragma once

#include "maze.h"

struct Player {
    float x;
    float y;
    float angle;
};

void raycast_frame(
    const Maze& maze,
    const Player& player,
    bool has_key,
    uint8_t* rgba_buffer,
    int width,
    int height);
