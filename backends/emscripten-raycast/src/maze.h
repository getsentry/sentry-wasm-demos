#pragma once

#include <cstdint>

constexpr int MAZE_MAX_WIDTH = 32;
constexpr int MAZE_MAX_HEIGHT = 32;

constexpr uint8_t CELL_OPEN = 0;
constexpr uint8_t CELL_WALL = 1;
constexpr uint8_t CELL_EXIT = 2;
constexpr uint8_t CELL_DOOR = 3;
constexpr uint8_t CELL_KEY = 4;
constexpr uint8_t CELL_ENTRANCE = 5;

class Maze {
public:
    Maze();

    void generate(int seed, int level);

    uint8_t cell(int x, int y) const;
    void set_cell(int x, int y, uint8_t value);

    bool blocks_movement(int x, int y, int keys_collected) const;
    bool blocks_raycast(int x, int y, int keys_collected) const;

    int keys_required() const { return key_count_; }

    int start_x() const { return start_x_; }
    int start_y() const { return start_y_; }
    float start_angle() const { return start_angle_; }
    int level() const { return level_; }

    int width() const { return width_; }
    int height() const { return height_; }

private:
    uint8_t grid_[MAZE_MAX_HEIGHT][MAZE_MAX_WIDTH];
    int key_count_;
    int start_x_;
    int start_y_;
    float start_angle_;
    int level_;
    int width_;
    int height_;
};
