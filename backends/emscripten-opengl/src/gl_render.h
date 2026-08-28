#pragma once

#include "maze.h"
#include "raycast_types.h"

void gl_render_init();
void gl_render_shutdown();
void gl_render_set_maze(const Maze& maze, int keys_collected);
void gl_render_world(const Maze& maze, const Player& player, int keys_collected, int level);
