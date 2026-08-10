#pragma once

#include "maze.h"
#include "raycast.h"

#include <cstdint>

constexpr int MINIMAP_SIZE = 128;

void draw_minimap(
    const Maze& maze,
    const Player& player,
    const bool explored[MAZE_MAX_HEIGHT][MAZE_MAX_WIDTH],
    uint8_t* rgba_buffer,
    int screen_width,
    int screen_height);
