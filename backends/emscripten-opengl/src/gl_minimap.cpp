#include "gl_minimap.h"

#include <GLES3/gl3.h>

#include <cmath>
#include <vector>

namespace {

constexpr int MINIMAP_SIZE = 128;

struct MiniVertex {
    float x;
    float y;
    float r;
    float g;
    float b;
};

GLuint minimap_program = 0;
GLuint minimap_vao = 0;
GLuint minimap_vbo = 0;
GLint minimap_u_mvp = -1;
bool minimap_ready = false;

const char* MINI_VERT = R"(#version 300 es
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec3 a_color;
uniform mat4 u_mvp;
out vec3 v_color;
void main() {
    v_color = a_color;
    gl_Position = u_mvp * vec4(a_pos, 0.0, 1.0);
}
)";

const char* MINI_FRAG = R"(#version 300 es
precision mediump float;
in vec3 v_color;
out vec4 fragColor;
void main() {
    fragColor = vec4(v_color, 1.0);
}
)";

GLuint compile_shader(GLenum type, const char* source) {
    const GLuint shader = glCreateShader(type);
    glShaderSource(shader, 1, &source, nullptr);
    glCompileShader(shader);

    GLint ok = 0;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &ok);
    if (!ok) {
        glDeleteShader(shader);
        return 0;
    }
    return shader;
}

GLuint link_program(const char* vert_src, const char* frag_src) {
    const GLuint vert = compile_shader(GL_VERTEX_SHADER, vert_src);
    const GLuint frag = compile_shader(GL_FRAGMENT_SHADER, frag_src);
    if (!vert || !frag) {
        if (vert) {
            glDeleteShader(vert);
        }
        if (frag) {
            glDeleteShader(frag);
        }
        return 0;
    }

    const GLuint program = glCreateProgram();
    glAttachShader(program, vert);
    glAttachShader(program, frag);
    glLinkProgram(program);
    glDeleteShader(vert);
    glDeleteShader(frag);

    GLint ok = 0;
    glGetProgramiv(program, GL_LINK_STATUS, &ok);
    if (!ok) {
        glDeleteProgram(program);
        return 0;
    }
    return program;
}

bool is_beacon_cell(uint8_t cell) {
    return cell == CELL_EXIT || cell == CELL_KEY;
}

void cell_color(uint8_t cell, float& r, float& g, float& b) {
    switch (cell) {
    case CELL_EXIT:
        r = 253.0f / 255.0f;
        g = 184.0f / 255.0f;
        b = 27.0f / 255.0f;
        break;
    case CELL_KEY:
        r = 62.0f / 255.0f;
        g = 220.0f / 255.0f;
        b = 255.0f / 255.0f;
        break;
    case CELL_ENTRANCE:
        r = 146.0f / 255.0f;
        g = 221.0f / 255.0f;
        b = 0.0f;
        break;
    case CELL_WALL:
        r = 78.0f / 255.0f;
        g = 42.0f / 255.0f;
        b = 154.0f / 255.0f;
        break;
    default:
        r = 24.0f / 255.0f;
        g = 18.0f / 255.0f;
        b = 37.0f / 255.0f;
        break;
    }
}

void fog_color(float& r, float& g, float& b) {
    r = 14.0f / 255.0f;
    g = 10.0f / 255.0f;
    b = 22.0f / 255.0f;
}

void append_rect(std::vector<MiniVertex>& out, float x0, float y0, float x1, float y1, float r, float g, float b) {
    out.push_back({x0, y0, r, g, b});
    out.push_back({x1, y0, r, g, b});
    out.push_back({x1, y1, r, g, b});
    out.push_back({x0, y0, r, g, b});
    out.push_back({x1, y1, r, g, b});
    out.push_back({x0, y1, r, g, b});
}

} // namespace

void gl_minimap_init() {
    if (minimap_ready) {
        return;
    }

    minimap_program = link_program(MINI_VERT, MINI_FRAG);
    if (!minimap_program) {
        return;
    }

    minimap_u_mvp = glGetUniformLocation(minimap_program, "u_mvp");

    glGenVertexArrays(1, &minimap_vao);
    glGenBuffers(1, &minimap_vbo);
    glBindVertexArray(minimap_vao);
    glBindBuffer(GL_ARRAY_BUFFER, minimap_vbo);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, sizeof(MiniVertex), reinterpret_cast<void*>(0));
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(MiniVertex), reinterpret_cast<void*>(2 * sizeof(float)));
    glBindVertexArray(0);

    minimap_ready = true;
}

void gl_minimap_shutdown() {
    if (!minimap_ready) {
        return;
    }
    glDeleteProgram(minimap_program);
    glDeleteBuffers(1, &minimap_vbo);
    glDeleteVertexArrays(1, &minimap_vao);
    minimap_program = 0;
    minimap_vao = 0;
    minimap_vbo = 0;
    minimap_ready = false;
}

void gl_draw_minimap(
    const Maze& maze,
    const Player& player,
    const bool explored[MAZE_MAX_HEIGHT][MAZE_MAX_WIDTH],
    int screen_width,
    int screen_height) {
    if (!minimap_ready) {
        gl_minimap_init();
    }
    if (!minimap_ready) {
        return;
    }

    const int map_x = screen_width - MINIMAP_SIZE - 8;
    const int map_y = 8;
    const int maze_w = maze.width();
    const int maze_h = maze.height();
    const float cell_px = static_cast<float>(MINIMAP_SIZE) / static_cast<float>(maze_w);

    std::vector<MiniVertex> vertices;
    vertices.reserve(static_cast<size_t>(maze_w * maze_h * 6 + 48));

    float br = 0.0f;
    float bg = 0.0f;
    float bb = 0.0f;
    fog_color(br, bg, bb);
    append_rect(
        vertices,
        static_cast<float>(map_x - 2),
        static_cast<float>(map_y - 2),
        static_cast<float>(map_x + MINIMAP_SIZE + 2),
        static_cast<float>(map_y + MINIMAP_SIZE + 2),
        br,
        bg,
        bb);

    for (int gy = 0; gy < maze_h; ++gy) {
        for (int gx = 0; gx < maze_w; ++gx) {
            float r = 0.0f;
            float g = 0.0f;
            float b = 0.0f;

            if (explored[gy][gx]) {
                cell_color(maze.cell(gx, gy), r, g, b);
            } else {
                fog_color(r, g, b);
            }

            const float px0 = static_cast<float>(map_x) + static_cast<float>(gx) * cell_px;
            const float py0 = static_cast<float>(map_y) + static_cast<float>(gy) * cell_px;
            append_rect(vertices, px0, py0, px0 + cell_px, py0 + cell_px, r, g, b);
        }
    }

    for (int gy = 0; gy < maze_h; ++gy) {
        for (int gx = 0; gx < maze_w; ++gx) {
            const uint8_t cell = maze.cell(gx, gy);
            if (!is_beacon_cell(cell)) {
                continue;
            }

            float r = 0.0f;
            float g = 0.0f;
            float b = 0.0f;
            cell_color(cell, r, g, b);

            const float px0 = static_cast<float>(map_x) + static_cast<float>(gx) * cell_px;
            const float py0 = static_cast<float>(map_y) + static_cast<float>(gy) * cell_px;
            append_rect(vertices, px0, py0, px0 + cell_px, py0 + cell_px, r, g, b);
        }
    }

    const float player_px = static_cast<float>(map_x) + player.x * cell_px;
    const float player_py = static_cast<float>(map_y) + player.y * cell_px;
    append_rect(vertices, player_px - 2.0f, player_py - 2.0f, player_px + 2.0f, player_py + 2.0f, 1.0f, 69.0f / 255.0f, 168.0f / 255.0f);

    const float tip_x = player_px + std::cos(player.angle) * 6.0f;
    const float tip_y = player_py + std::sin(player.angle) * 6.0f;
    append_rect(vertices, tip_x - 1.0f, tip_y - 1.0f, tip_x + 1.0f, tip_y + 1.0f, 253.0f / 255.0f, 184.0f / 255.0f, 27.0f / 255.0f);

    const int vertex_count = static_cast<int>(vertices.size());
    if (vertex_count == 0) {
        return;
    }

    glBindBuffer(GL_ARRAY_BUFFER, minimap_vbo);
    glBufferData(GL_ARRAY_BUFFER, vertex_count * sizeof(MiniVertex), vertices.data(), GL_DYNAMIC_DRAW);

    const int gl_y = screen_height - map_y - MINIMAP_SIZE;
    glEnable(GL_SCISSOR_TEST);
    glScissor(map_x - 2, gl_y - 2, MINIMAP_SIZE + 4, MINIMAP_SIZE + 4);
    glViewport(map_x - 2, gl_y - 2, MINIMAP_SIZE + 4, MINIMAP_SIZE + 4);
    glDisable(GL_DEPTH_TEST);

    float mvp[16] = {
        2.0f / static_cast<float>(screen_width),
        0.0f,
        0.0f,
        0.0f,
        0.0f,
        -2.0f / static_cast<float>(screen_height),
        0.0f,
        0.0f,
        0.0f,
        0.0f,
        1.0f,
        0.0f,
        -1.0f,
        1.0f,
        0.0f,
        1.0f,
    };

    glUseProgram(minimap_program);
    glUniformMatrix4fv(minimap_u_mvp, 1, GL_FALSE, mvp);

    glBindVertexArray(minimap_vao);
    glDrawArrays(GL_TRIANGLES, 0, vertex_count);
    glBindVertexArray(0);

    glEnable(GL_DEPTH_TEST);
    glDisable(GL_SCISSOR_TEST);
}
