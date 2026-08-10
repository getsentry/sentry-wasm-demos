#pragma once

#include <cstdint>

constexpr int MAZE_WIDTH = 16;
constexpr int MAZE_HEIGHT = 16;

constexpr int MAZE_START_X = 1;
constexpr int MAZE_START_Y = 1;

constexpr uint8_t CELL_OPEN = 0;
constexpr uint8_t CELL_WALL = 1;
constexpr uint8_t CELL_EXIT = 2;
constexpr uint8_t CELL_DOOR = 3;
constexpr uint8_t CELL_KEY = 4;

class Maze {
public:
    Maze();

    void generate(int seed);

    uint8_t cell(int x, int y) const;
    void set_cell(int x, int y, uint8_t value);

    bool blocks_movement(int x, int y, bool has_key) const;
    bool blocks_raycast(int x, int y, bool has_key) const;

    int width() const { return MAZE_WIDTH; }
    int height() const { return MAZE_HEIGHT; }

private:
    uint8_t grid_[MAZE_HEIGHT][MAZE_WIDTH];
};
