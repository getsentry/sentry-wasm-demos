#include "maze.h"

#include <cmath>
#include <cstring>

namespace {

constexpr int kDx[4] = {1, -1, 0, 0};
constexpr int kDy[4] = {0, 0, 1, -1};

struct Rng {
    uint32_t state;

    explicit Rng(uint32_t seed) : state(seed != 0 ? seed : 1u) {}

    uint32_t next() {
        state = state * 1664525u + 1013904223u;
        return state;
    }

    int range(int lo, int hi_inclusive) {
        const int span = hi_inclusive - lo + 1;
        return lo + static_cast<int>(next() % static_cast<uint32_t>(span));
    }

    void shuffle_dirs(int order[4]) {
        order[0] = 0;
        order[1] = 1;
        order[2] = 2;
        order[3] = 3;
        for (int i = 3; i > 0; --i) {
            const int j = range(0, i);
            const int tmp = order[i];
            order[i] = order[j];
            order[j] = tmp;
        }
    }
};

int maze_size_for_level(int level) {
    int size = 9 + ((level - 1) / 2) * 2;
    if (size > MAZE_MAX_WIDTH) {
        size = MAZE_MAX_WIDTH;
    }
    if (size % 2 == 0) {
        --size;
    }
    return size;
}

int key_count_for_level(int level) {
    int count = (level + 1) / 2;
    if (count < 1) {
        count = 1;
    }
    if (count > 8) {
        count = 8;
    }
    return count;
}

bool in_bounds(int x, int y, int maze_w, int maze_h) {
    return x >= 1 && y >= 1 && x <= maze_w - 2 && y <= maze_h - 2;
}

bool is_walkable(uint8_t cell) {
    return cell != CELL_WALL;
}

bool touches_other_open(
    const uint8_t grid[MAZE_MAX_HEIGHT][MAZE_MAX_WIDTH],
    int nx,
    int ny,
    int allow_x,
    int allow_y,
    int maze_w,
    int maze_h) {
    for (int i = 0; i < 4; ++i) {
        const int ax = nx + kDx[i];
        const int ay = ny + kDy[i];
        if (ax < 0 || ay < 0 || ax >= maze_w || ay >= maze_h) {
            continue;
        }
        if (ax == allow_x && ay == allow_y) {
            continue;
        }
        if (is_walkable(grid[ay][ax])) {
            return true;
        }
    }
    return false;
}

int carve_main_path_to_target(
    uint8_t grid[MAZE_MAX_HEIGHT][MAZE_MAX_WIDTH],
    int maze_w,
    int maze_h,
    int start_x,
    int start_y,
    int target_x,
    int target_y,
    int path_x[],
    int path_y[],
    Rng& rng) {
    grid[start_y][start_x] = CELL_OPEN;
    int len = 1;
    path_x[0] = start_x;
    path_y[0] = start_y;

    int x = start_x;
    int y = start_y;
    const int max_steps = (maze_w - 2) * (maze_h - 2);

    auto manhattan = [&](int px, int py) {
        return std::abs(px - target_x) + std::abs(py - target_y);
    };

    while (x != target_x || y != target_y) {
        int order[4];
        rng.shuffle_dirs(order);

        int valid_dirs[4];
        int valid_count = 0;
        for (int i = 0; i < 4; ++i) {
            const int nx = x + kDx[order[i]];
            const int ny = y + kDy[order[i]];
            if (!in_bounds(nx, ny, maze_w, maze_h)) {
                continue;
            }
            if (grid[ny][nx] != CELL_WALL) {
                continue;
            }
            if (touches_other_open(grid, nx, ny, x, y, maze_w, maze_h)) {
                continue;
            }
            valid_dirs[valid_count++] = order[i];
        }

        if (valid_count == 0) {
            return -1;
        }

        int best_dist = maze_w + maze_h;
        for (int i = 0; i < valid_count; ++i) {
            const int dir = valid_dirs[i];
            const int dist = manhattan(x + kDx[dir], y + kDy[dir]);
            if (dist < best_dist) {
                best_dist = dist;
            }
        }

        int candidates[4];
        int candidate_count = 0;
        for (int i = 0; i < valid_count; ++i) {
            const int dir = valid_dirs[i];
            if (manhattan(x + kDx[dir], y + kDy[dir]) == best_dist) {
                candidates[candidate_count++] = dir;
            }
        }

        const int chosen = candidates[rng.range(0, candidate_count - 1)];
        x += kDx[chosen];
        y += kDy[chosen];
        grid[y][x] = CELL_OPEN;
        path_x[len] = x;
        path_y[len] = y;
        ++len;

        if (len > max_steps) {
            return -1;
        }
    }

    return len;
}

int carve_monotone_path(
    uint8_t grid[MAZE_MAX_HEIGHT][MAZE_MAX_WIDTH],
    int maze_w,
    int maze_h,
    int start_x,
    int start_y,
    int target_x,
    int target_y,
    int path_x[],
    int path_y[],
    Rng& rng) {
    const int east_steps = target_x - start_x;
    const int south_steps = target_y - start_y;
    if (east_steps < 0 || south_steps < 0) {
        return -1;
    }

    int moves[MAZE_MAX_WIDTH * MAZE_MAX_HEIGHT];
    int move_count = 0;
    for (int i = 0; i < east_steps; ++i) {
        moves[move_count++] = 0;
    }
    for (int i = 0; i < south_steps; ++i) {
        moves[move_count++] = 2;
    }

    for (int i = move_count - 1; i > 0; --i) {
        const int j = rng.range(0, i);
        const int tmp = moves[i];
        moves[i] = moves[j];
        moves[j] = tmp;
    }

    grid[start_y][start_x] = CELL_OPEN;
    int len = 1;
    path_x[0] = start_x;
    path_y[0] = start_y;

    int x = start_x;
    int y = start_y;
    for (int i = 0; i < move_count; ++i) {
        const int dir = moves[i];
        x += kDx[dir];
        y += kDy[dir];
        if (!in_bounds(x, y, maze_w, maze_h)) {
            return -1;
        }
        grid[y][x] = CELL_OPEN;
        path_x[len] = x;
        path_y[len] = y;
        ++len;
    }

    if (x != target_x || y != target_y) {
        return -1;
    }
    return len;
}

bool carve_key_branch(
    uint8_t grid[MAZE_MAX_HEIGHT][MAZE_MAX_WIDTH],
    int maze_w,
    int maze_h,
    int fork_x,
    int fork_y,
    int branch_steps,
    Rng& rng,
    int& key_x,
    int& key_y) {
    int x = fork_x;
    int y = fork_y;

    for (int step = 0; step < branch_steps; ++step) {
        int order[4];
        rng.shuffle_dirs(order);

        bool carved = false;
        for (int i = 0; i < 4; ++i) {
            const int nx = x + kDx[order[i]];
            const int ny = y + kDy[order[i]];
            if (!in_bounds(nx, ny, maze_w, maze_h)) {
                continue;
            }
            if (grid[ny][nx] != CELL_WALL) {
                continue;
            }
            if (touches_other_open(grid, nx, ny, x, y, maze_w, maze_h)) {
                continue;
            }

            grid[ny][nx] = CELL_OPEN;
            x = nx;
            y = ny;
            carved = true;
            break;
        }

        if (!carved) {
            return false;
        }
    }

    key_x = x;
    key_y = y;
    return true;
}

void place_keys(
    uint8_t grid[MAZE_MAX_HEIGHT][MAZE_MAX_WIDTH],
    int maze_w,
    int maze_h,
    int& key_count,
    int level,
    const int path_x[],
    const int path_y[],
    int path_len,
    Rng& rng) {
    const int desired = key_count_for_level(level);
    key_count = 0;

    const int min_len = desired + 2;
    if (path_len < min_len) {
        return;
    }

    const int fork_hi = path_len - 2;
    if (fork_hi < 1) {
        return;
    }

    int fork_order[MAZE_MAX_WIDTH * MAZE_MAX_HEIGHT];
    int fork_count = 0;
    for (int idx = 1; idx <= fork_hi; ++idx) {
        fork_order[fork_count++] = idx;
    }
    for (int i = fork_count - 1; i > 0; --i) {
        const int j = rng.range(0, i);
        const int tmp = fork_order[i];
        fork_order[i] = fork_order[j];
        fork_order[j] = tmp;
    }

    for (int i = 0; i < fork_count && key_count < desired; ++i) {
        const int fork_idx = fork_order[i];
        int key_x = 0;
        int key_y = 0;
        if (!carve_key_branch(
                grid,
                maze_w,
                maze_h,
                path_x[fork_idx],
                path_y[fork_idx],
                1 + rng.range(0, 2),
                rng,
                key_x,
                key_y)) {
            continue;
        }

        grid[key_y][key_x] = CELL_KEY;
        ++key_count;
    }
}

} // namespace

Maze::Maze()
    : grid_(),
      key_count_(0),
      start_x_(1),
      start_y_(1),
      start_angle_(0.0f),
      level_(1),
      width_(MAZE_MAX_WIDTH),
      height_(MAZE_MAX_HEIGHT) {
    std::memset(grid_, CELL_WALL, sizeof(grid_));
}

void Maze::generate(int seed, int level) {
    level_ = level < 1 ? 1 : level;
    width_ = maze_size_for_level(level_);
    height_ = width_;
    key_count_ = 0;

    start_x_ = 1;
    start_y_ = 1;
    start_angle_ = 0.0f;

    const int exit_x = width_ - 2;
    const int exit_y = height_ - 2;

    int path_x[MAZE_MAX_WIDTH * MAZE_MAX_HEIGHT];
    int path_y[MAZE_MAX_WIDTH * MAZE_MAX_HEIGHT];
    int path_len = -1;

    for (int attempt = 0; attempt < 32 && path_len < 0; ++attempt) {
        std::memset(grid_, CELL_WALL, sizeof(grid_));
        grid_[start_y_][0] = CELL_ENTRANCE;

        Rng rng(static_cast<uint32_t>(seed) ^
                static_cast<uint32_t>(level_ * 2654435761u) ^
                static_cast<uint32_t>(attempt * 2246822519u));

        path_len = carve_main_path_to_target(
            grid_,
            width_,
            height_,
            start_x_,
            start_y_,
            exit_x,
            exit_y,
            path_x,
            path_y,
            rng);

        if (path_len >= 0) {
            place_keys(grid_, width_, height_, key_count_, level_, path_x, path_y, path_len, rng);
            break;
        }
    }

    if (path_len < 0) {
        std::memset(grid_, CELL_WALL, sizeof(grid_));
        grid_[start_y_][0] = CELL_ENTRANCE;

        Rng rng(static_cast<uint32_t>(seed) ^ static_cast<uint32_t>(level_ * 2654435761u));
        path_len = carve_monotone_path(
            grid_,
            width_,
            height_,
            start_x_,
            start_y_,
            exit_x,
            exit_y,
            path_x,
            path_y,
            rng);
        place_keys(grid_, width_, height_, key_count_, level_, path_x, path_y, path_len, rng);
    }

    grid_[start_y_][start_x_] = CELL_OPEN;
    grid_[exit_y][exit_x] = CELL_EXIT;
    grid_[exit_y][width_ - 1] = CELL_EXIT;
    grid_[height_ - 1][exit_x] = CELL_EXIT;
    grid_[height_ - 1][width_ - 1] = CELL_EXIT;
}

uint8_t Maze::cell(int x, int y) const {
    if (x < 0 || y < 0 || x >= width_ || y >= height_) {
        return CELL_WALL;
    }
    return grid_[y][x];
}

void Maze::set_cell(int x, int y, uint8_t value) {
    if (x < 0 || y < 0 || x >= width_ || y >= height_) {
        return;
    }
    grid_[y][x] = value;
}

bool Maze::blocks_movement(int x, int y, int keys_collected) const {
    const uint8_t c = cell(x, y);
    if (c == CELL_OPEN || c == CELL_KEY || c == CELL_ENTRANCE) {
        return false;
    }
    if (c == CELL_EXIT) {
        return keys_collected < key_count_;
    }
    return true;
}

bool Maze::blocks_raycast(int x, int y, int keys_collected) const {
    return blocks_movement(x, y, keys_collected);
}
