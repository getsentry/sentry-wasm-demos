#pragma once

#include <cstdint>

constexpr int MAZE_WIDTH = 16;
constexpr int MAZE_HEIGHT = 16;

// Cell values: 0 = open, 1 = wall
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
