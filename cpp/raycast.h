#pragma once

#include "maze.h"

struct Player {
    float x;
    float y;
    float angle;
};

// Fill rgba_buffer with a first-person view from player through the maze grid.
void raycast_frame(const Maze& maze, const Player& player, uint8_t* rgba_buffer, int width, int height);
