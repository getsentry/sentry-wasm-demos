#pragma once

#include "maze.h"

struct Player {
    float x;
    float y;
    float angle;
};

// Stub: will cast rays against the maze grid and write wall colors to the buffer.
void raycast_frame(const Maze& maze, const Player& player, uint8_t* rgba_buffer, int width, int height);
