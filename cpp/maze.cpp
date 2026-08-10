#include "maze.h"

#include <cstring>

Maze::Maze() {
    std::memset(grid_, 1, sizeof(grid_));
}

void Maze::generate() {
    // Stub: border walls with a simple open interior pattern.
    for (int y = 0; y < MAZE_HEIGHT; ++y) {
        for (int x = 0; x < MAZE_WIDTH; ++x) {
            const bool border = x == 0 || y == 0 || x == MAZE_WIDTH - 1 || y == MAZE_HEIGHT - 1;
            const bool checker = ((x + y) % 2) == 0;
            grid_[y][x] = (border || checker) ? 1 : 0;
        }
    }

    // Carve a starting alcove so the player has room later.
    grid_[1][1] = 0;
    grid_[1][2] = 0;
    grid_[2][1] = 0;
}

bool Maze::is_wall(int x, int y) const {
    if (x < 0 || y < 0 || x >= MAZE_WIDTH || y >= MAZE_HEIGHT) {
        return true;
    }
    return grid_[y][x] != 0;
}
