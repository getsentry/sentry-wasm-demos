#pragma once

#include <cstdint>

constexpr int MAZE_WIDTH = 16;
constexpr int MAZE_HEIGHT = 16;
constexpr int MAX_DOORS = 4;

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

    int door_index_at(int x, int y) const;
    int door_count() const { return door_count_; }
    int keys_required() const { return door_count_; }

    int start_x() const { return start_x_; }
    int start_y() const { return start_y_; }
    float start_angle() const { return start_angle_; }
    int level() const { return level_; }

    int width() const { return MAZE_WIDTH; }
    int height() const { return MAZE_HEIGHT; }

private:
    void place_key_and_doors_on_path(const int path_x[], const int path_y[], int path_len);

    uint8_t grid_[MAZE_HEIGHT][MAZE_WIDTH];
    int door_x_[MAX_DOORS];
    int door_y_[MAX_DOORS];
    int door_count_;
    int start_x_;
    int start_y_;
    float start_angle_;
    int level_;
};
