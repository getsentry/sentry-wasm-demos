#pragma once

#include "maze.h"
#include "raycast_types.h"

#include <cstdint>

void gl_minimap_init();
void gl_minimap_shutdown();
void gl_draw_minimap(
    const Maze& maze,
    const Player& player,
    const bool explored[MAZE_MAX_HEIGHT][MAZE_MAX_WIDTH],
    int screen_width,
    int screen_height);
