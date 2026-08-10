#pragma once

#include <cstdint>

constexpr int MAZE_WIDTH = 16;
constexpr int MAZE_HEIGHT = 16;

// Open spawn cell carved by generate(); player starts at its center.
constexpr int MAZE_START_X = 1;
constexpr int MAZE_START_Y = 1;

// Cell values: 0 = open, >= 1 = wall (blocks rays; movement logic may differ later).
class Maze {
public:
    Maze();

    void generate();

    bool is_wall(int x, int y) const;
    int width() const { return MAZE_WIDTH; }
    int height() const { return MAZE_HEIGHT; }

private:
    uint8_t grid_[MAZE_HEIGHT][MAZE_WIDTH];
};
