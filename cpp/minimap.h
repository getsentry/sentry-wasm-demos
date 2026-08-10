#pragma once

#include "maze.h"
#include "raycast.h"

#include <cstdint>

constexpr int MINIMAP_SIZE = 128;

void draw_minimap(
    const Maze& maze,
    const Player& player,
    bool has_key,
    uint8_t* rgba_buffer,
    int screen_width,
    int screen_height);
