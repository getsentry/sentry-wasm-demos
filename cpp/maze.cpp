#include "maze.h"

#include <cstring>

Maze::Maze() {
    std::memset(grid_, CELL_WALL, sizeof(grid_));
}

void Maze::generate(int seed) {
    std::memset(grid_, CELL_WALL, sizeof(grid_));

    // Open interior — border stays solid.
    for (int y = 1; y < MAZE_HEIGHT - 1; ++y) {
        for (int x = 1; x < MAZE_WIDTH - 1; ++x) {
            grid_[y][x] = CELL_OPEN;
        }
    }

    // Spawn alcove.
    grid_[1][1] = CELL_OPEN;
    grid_[1][2] = CELL_OPEN;
    grid_[2][1] = CELL_OPEN;

    // Divider wall with a locked door; key sits on the west side.
    for (int y = 2; y <= 10; ++y) {
        grid_[y][7] = CELL_WALL;
    }
    grid_[4][7] = CELL_DOOR;
    grid_[4][5] = CELL_KEY;

    // Exit chamber in the far corner (seed reserved for future layout variation).
    grid_[12][12] = CELL_EXIT;
    grid_[12][13] = CELL_OPEN;
    grid_[13][12] = CELL_OPEN;

    (void)seed;
}

uint8_t Maze::cell(int x, int y) const {
    if (x < 0 || y < 0 || x >= MAZE_WIDTH || y >= MAZE_HEIGHT) {
        return CELL_WALL;
    }
    return grid_[y][x];
}

void Maze::set_cell(int x, int y, uint8_t value) {
    if (x < 0 || y < 0 || x >= MAZE_WIDTH || y >= MAZE_HEIGHT) {
        return;
    }
    grid_[y][x] = value;
}

bool Maze::blocks_movement(int x, int y, bool has_key) const {
    const uint8_t c = cell(x, y);
    if (c == CELL_OPEN || c == CELL_EXIT || c == CELL_KEY) {
        return false;
    }
    if (c == CELL_DOOR) {
        return !has_key;
    }
    return true;
}

bool Maze::blocks_raycast(int x, int y, bool has_key) const {
    const uint8_t c = cell(x, y);
    if (c == CELL_OPEN || c == CELL_EXIT || c == CELL_KEY) {
        return false;
    }
    if (c == CELL_DOOR) {
        return !has_key;
    }
    return true;
}
