#include "gl_render.h"

#include <GLES3/gl3.h>
#include <emscripten/html5.h>

#include <algorithm>
#include <cmath>
#include <cstring>
#include <vector>

namespace {

constexpr float FOV = 0.66f;
constexpr float MAX_DEPTH = 9.0f;
constexpr float FOG_STRENGTH = 0.88f;
constexpr float WALL_HEIGHT = 1.0f;
constexpr float CEILING_HEIGHT = 1.0f;

struct Color {
    uint8_t r;
    uint8_t g;
    uint8_t b;
};

constexpr Color COLOR_RICH_BLACK = {24, 18, 37};
constexpr Color COLOR_WALL_BLURPLE = {78, 42, 154};
constexpr Color COLOR_WALL_LT_BLURPLE = {158, 134, 255};
constexpr Color COLOR_WALL_PINK = {255, 69, 168};
constexpr Color COLOR_WALL_LT_PINK = {255, 112, 188};
constexpr Color COLOR_WALL_ORANGE = {238, 128, 25};
constexpr Color COLOR_WALL_LT_ORANGE = {255, 152, 56};
constexpr Color COLOR_FLOOR_EXIT = {253, 184, 27};
constexpr Color COLOR_FLOOR_KEY = {62, 220, 255};

constexpr int WALL_PALETTE_SIZE = 6;
constexpr Color WALL_PALETTE[WALL_PALETTE_SIZE] = {
    COLOR_WALL_BLURPLE,
    COLOR_WALL_LT_BLURPLE,
    COLOR_WALL_PINK,
    COLOR_WALL_LT_PINK,
    COLOR_WALL_ORANGE,
    COLOR_WALL_LT_ORANGE,
};

struct Vertex {
    float x;
    float y;
    float z;
    float r;
    float g;
    float b;
};

struct Mat4 {
    float m[16];
};

GLuint world_program = 0;
GLuint world_vao = 0;
GLuint world_vbo = 0;
GLint world_u_mvp = -1;
GLint world_u_camera_pos = -1;
GLint world_u_fog_color = -1;
GLint world_u_max_depth = -1;
GLint world_u_fog_strength = -1;

std::vector<Vertex> world_vertices;
int world_vertex_count = 0;
int last_mesh_keys = -1;
int last_mesh_seed = -1;
int last_mesh_level = -1;
bool gl_ready = false;

bool ensure_webgl_context() {
    static EMSCRIPTEN_WEBGL_CONTEXT_HANDLE context = 0;
    if (context > 0) {
        return emscripten_webgl_make_context_current(context) == EMSCRIPTEN_RESULT_SUCCESS;
    }

    EmscriptenWebGLContextAttributes attrs;
    emscripten_webgl_init_context_attributes(&attrs);
    attrs.majorVersion = 2;
    attrs.minorVersion = 0;
    attrs.alpha = EM_FALSE;
    attrs.depth = EM_TRUE;
    attrs.stencil = EM_FALSE;
    attrs.antialias = EM_TRUE;

    context = emscripten_webgl_create_context("#screen", &attrs);
    if (context <= 0) {
        return false;
    }
    return emscripten_webgl_make_context_current(context) == EMSCRIPTEN_RESULT_SUCCESS;
}

const char* WORLD_VERT = R"(#version 300 es
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_color;
uniform mat4 u_mvp;
out vec3 v_color;
out vec3 v_world_pos;
void main() {
    v_world_pos = a_pos;
    v_color = a_color;
    gl_Position = u_mvp * vec4(a_pos, 1.0);
}
)";

const char* WORLD_FRAG = R"(#version 300 es
precision mediump float;
in vec3 v_color;
in vec3 v_world_pos;
uniform vec3 u_camera_pos;
uniform vec3 u_fog_color;
uniform float u_max_depth;
uniform float u_fog_strength;
out vec4 fragColor;
void main() {
    float dist = length(v_world_pos - u_camera_pos);
    float fog = clamp(dist / u_max_depth, 0.0, 1.0);
    float keep = 1.0 - fog * u_fog_strength;
    vec3 c = v_color * keep + u_fog_color * (1.0 - keep);
    fragColor = vec4(c, 1.0);
}
)";

Mat4 mat4_identity() {
    Mat4 out{};
    out.m[0] = out.m[5] = out.m[10] = out.m[15] = 1.0f;
    return out;
}

Mat4 mat4_mul(const Mat4& a, const Mat4& b) {
    Mat4 out{};
    for (int col = 0; col < 4; ++col) {
        for (int row = 0; row < 4; ++row) {
            out.m[col * 4 + row] = 0.0f;
            for (int k = 0; k < 4; ++k) {
                out.m[col * 4 + row] += a.m[k * 4 + row] * b.m[col * 4 + k];
            }
        }
    }
    return out;
}

Mat4 mat4_perspective(float fov_y, float aspect, float near_plane, float far_plane) {
    Mat4 out{};
    const float f = 1.0f / std::tan(fov_y * 0.5f);
    out.m[0] = f / aspect;
    out.m[5] = f;
    out.m[10] = (far_plane + near_plane) / (near_plane - far_plane);
    out.m[11] = -1.0f;
    out.m[14] = (2.0f * far_plane * near_plane) / (near_plane - far_plane);
    return out;
}

Mat4 mat4_look_at(float eye_x, float eye_y, float eye_z, float center_x, float center_y, float center_z) {
    float fx = center_x - eye_x;
    float fy = center_y - eye_y;
    float fz = center_z - eye_z;
    const float flen = std::sqrt(fx * fx + fy * fy + fz * fz);
    if (flen > 0.0f) {
        fx /= flen;
        fy /= flen;
        fz /= flen;
    }

    float sx = fy * 0.0f - fz * 1.0f;
    float sy = fz * 0.0f - fx * 0.0f;
    float sz = fx * 1.0f - fy * 0.0f;
    const float slen = std::sqrt(sx * sx + sy * sy + sz * sz);
    if (slen > 0.0f) {
        sx /= slen;
        sy /= slen;
        sz /= slen;
    }

    const float ux = sy * fz - sz * fy;
    const float uy = sz * fx - sx * fz;
    const float uz = sx * fy - sy * fx;

    Mat4 out = mat4_identity();
    out.m[0] = sx;
    out.m[1] = ux;
    out.m[2] = -fx;
    out.m[4] = sy;
    out.m[5] = uy;
    out.m[6] = -fy;
    out.m[8] = sz;
    out.m[9] = uz;
    out.m[10] = -fz;
    out.m[12] = -(sx * eye_x + sy * eye_y + sz * eye_z);
    out.m[13] = -(ux * eye_x + uy * eye_y + uz * eye_z);
    out.m[14] = fx * eye_x + fy * eye_y + fz * eye_z;
    return out;
}

GLuint compile_shader(GLenum type, const char* source) {
    const GLuint shader = glCreateShader(type);
    glShaderSource(shader, 1, &source, nullptr);
    glCompileShader(shader);

    GLint ok = 0;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &ok);
    if (!ok) {
        char log[512];
        glGetShaderInfoLog(shader, sizeof(log), nullptr, log);
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

Color floor_color_for_cell(uint8_t cell) {
    switch (cell) {
    case CELL_EXIT:
        return COLOR_FLOOR_EXIT;
    case CELL_KEY:
        return COLOR_FLOOR_KEY;
    default:
        return COLOR_RICH_BLACK;
    }
}

void push_color(float& r, float& g, float& b, uint8_t ir, uint8_t ig, uint8_t ib, float shade = 1.0f) {
    r = (static_cast<float>(ir) / 255.0f) * shade;
    g = (static_cast<float>(ig) / 255.0f) * shade;
    b = (static_cast<float>(ib) / 255.0f) * shade;
}

void append_quad(
    std::vector<Vertex>& out,
    float x0,
    float y0,
    float z0,
    float x1,
    float y1,
    float z1,
    float x2,
    float y2,
    float z2,
    float x3,
    float y3,
    float z3,
    float r,
    float g,
    float b) {
    out.push_back({x0, y0, z0, r, g, b});
    out.push_back({x1, y1, z1, r, g, b});
    out.push_back({x2, y2, z2, r, g, b});
    out.push_back({x0, y0, z0, r, g, b});
    out.push_back({x2, y2, z2, r, g, b});
    out.push_back({x3, y3, z3, r, g, b});
}

void append_floor_cell(std::vector<Vertex>& out, int cx, int cy, const Color& color) {
    float r = 0.0f;
    float g = 0.0f;
    float b = 0.0f;
    push_color(r, g, b, color.r, color.g, color.b);
    const float x = static_cast<float>(cx);
    const float z = static_cast<float>(cy);
    append_quad(out, x, 0.0f, z, x + 1.0f, 0.0f, z, x + 1.0f, 0.0f, z + 1.0f, x, 0.0f, z + 1.0f, r, g, b);
}

void append_ceiling_cell(std::vector<Vertex>& out, int cx, int cy) {
    float r = 0.0f;
    float g = 0.0f;
    float b = 0.0f;
    push_color(r, g, b, 36, 28, 52, 0.55f);
    const float x = static_cast<float>(cx);
    const float z = static_cast<float>(cy);
    // CCW when viewed from below (camera inside the maze).
    append_quad(
        out,
        x,
        CEILING_HEIGHT,
        z,
        x,
        CEILING_HEIGHT,
        z + 1.0f,
        x + 1.0f,
        CEILING_HEIGHT,
        z + 1.0f,
        x + 1.0f,
        CEILING_HEIGHT,
        z,
        r,
        g,
        b);
}

void append_wall_face_ccw(
    std::vector<Vertex>& out,
    int map_x,
    int map_y,
    float ax,
    float ay,
    float az,
    float bx,
    float by,
    float bz,
    float cx,
    float cy,
    float cz,
    float dx,
    float dy,
    float dz,
    bool dim) {
    const Color base = WALL_PALETTE[(map_x + map_y) % WALL_PALETTE_SIZE];
    float r = 0.0f;
    float g = 0.0f;
    float b = 0.0f;
    const float shade = dim ? 0.72f : 1.0f;
    push_color(r, g, b, base.r, base.g, base.b, shade);
    append_quad(out, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, r, g, b);
}

void append_wall_block_faces(
    std::vector<Vertex>& out,
    const Maze& maze,
    int cx,
    int cy,
    int keys_collected) {
    if (!maze.blocks_raycast(cx, cy, keys_collected)) {
        return;
    }

    const float x = static_cast<float>(cx);
    const float z = static_cast<float>(cy);

    if (!maze.blocks_raycast(cx - 1, cy, keys_collected)) {
        append_wall_face_ccw(
            out,
            cx,
            cy,
            x,
            0.0f,
            z,
            x,
            0.0f,
            z + 1.0f,
            x,
            WALL_HEIGHT,
            z + 1.0f,
            x,
            WALL_HEIGHT,
            z,
            true);
    }
    if (!maze.blocks_raycast(cx + 1, cy, keys_collected)) {
        append_wall_face_ccw(
            out,
            cx,
            cy,
            x + 1.0f,
            0.0f,
            z,
            x + 1.0f,
            WALL_HEIGHT,
            z,
            x + 1.0f,
            WALL_HEIGHT,
            z + 1.0f,
            x + 1.0f,
            0.0f,
            z + 1.0f,
            true);
    }
    if (!maze.blocks_raycast(cx, cy - 1, keys_collected)) {
        append_wall_face_ccw(
            out,
            cx,
            cy,
            x,
            0.0f,
            z,
            x + 1.0f,
            0.0f,
            z,
            x + 1.0f,
            WALL_HEIGHT,
            z,
            x,
            WALL_HEIGHT,
            z,
            false);
    }
    if (!maze.blocks_raycast(cx, cy + 1, keys_collected)) {
        append_wall_face_ccw(
            out,
            cx,
            cy,
            x + 1.0f,
            0.0f,
            z + 1.0f,
            x,
            0.0f,
            z + 1.0f,
            x,
            WALL_HEIGHT,
            z + 1.0f,
            x + 1.0f,
            WALL_HEIGHT,
            z + 1.0f,
            false);
    }
}

void append_key_marker(std::vector<Vertex>& out, int cx, int cy) {
    float r = 0.0f;
    float g = 0.0f;
    float b = 0.0f;
    push_color(r, g, b, COLOR_FLOOR_KEY.r, COLOR_FLOOR_KEY.g, COLOR_FLOOR_KEY.b);
    const float x = static_cast<float>(cx) + 0.25f;
    const float z = static_cast<float>(cy) + 0.25f;
    const float s = 0.5f;
    append_quad(out, x, 0.05f, z, x + s, 0.05f, z, x + s, 0.05f, z + s, x, 0.05f, z + s, r, g, b);
    append_quad(out, x, 0.35f, z, x + s, 0.35f, z, x + s, 0.35f, z + s, x, 0.35f, z + s, r, g, b);
    append_quad(out, x, 0.05f, z, x + s, 0.05f, z, x + s, 0.35f, z, x, 0.35f, z, r, g, b);
    append_quad(out, x + s, 0.05f, z, x + s, 0.05f, z + s, x + s, 0.35f, z + s, x + s, 0.35f, z, r, g, b);
    append_quad(out, x, 0.05f, z + s, x + s, 0.05f, z + s, x + s, 0.35f, z + s, x, 0.35f, z + s, r, g, b);
    append_quad(out, x, 0.05f, z, x, 0.05f, z + s, x, 0.35f, z + s, x, 0.35f, z, r, g, b);
}

void build_world_mesh(const Maze& maze, int keys_collected) {
    world_vertices.clear();

    const int maze_w = maze.width();
    const int maze_h = maze.height();

    for (int cy = 0; cy < maze_h; ++cy) {
        for (int cx = 0; cx < maze_w; ++cx) {
            const uint8_t cell = maze.cell(cx, cy);
            append_floor_cell(world_vertices, cx, cy, floor_color_for_cell(cell));
            append_ceiling_cell(world_vertices, cx, cy);

            if (cell == CELL_KEY) {
                append_key_marker(world_vertices, cx, cy);
            }

            append_wall_block_faces(world_vertices, maze, cx, cy, keys_collected);
        }
    }

    world_vertex_count = static_cast<int>(world_vertices.size());
    if (world_vertex_count == 0) {
        return;
    }

    glBindBuffer(GL_ARRAY_BUFFER, world_vbo);
    glBufferData(GL_ARRAY_BUFFER, world_vertex_count * sizeof(Vertex), world_vertices.data(), GL_STATIC_DRAW);
}

} // namespace

void gl_render_init() {
    if (gl_ready) {
        return;
    }

    if (!ensure_webgl_context()) {
        return;
    }

    world_program = link_program(WORLD_VERT, WORLD_FRAG);
    if (!world_program) {
        return;
    }

    world_u_mvp = glGetUniformLocation(world_program, "u_mvp");
    world_u_camera_pos = glGetUniformLocation(world_program, "u_camera_pos");
    world_u_fog_color = glGetUniformLocation(world_program, "u_fog_color");
    world_u_max_depth = glGetUniformLocation(world_program, "u_max_depth");
    world_u_fog_strength = glGetUniformLocation(world_program, "u_fog_strength");

    glGenVertexArrays(1, &world_vao);
    glGenBuffers(1, &world_vbo);
    glBindVertexArray(world_vao);
    glBindBuffer(GL_ARRAY_BUFFER, world_vbo);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), reinterpret_cast<void*>(0));
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Vertex), reinterpret_cast<void*>(3 * sizeof(float)));
    glBindVertexArray(0);

    glEnable(GL_DEPTH_TEST);
    glDisable(GL_CULL_FACE);

    gl_ready = true;
}

void gl_render_shutdown() {
    if (!gl_ready) {
        return;
    }
    glDeleteProgram(world_program);
    glDeleteBuffers(1, &world_vbo);
    glDeleteVertexArrays(1, &world_vao);
    world_program = 0;
    world_vao = 0;
    world_vbo = 0;
    gl_ready = false;
}

void gl_render_set_maze(const Maze& maze, int keys_collected) {
    if (!gl_ready) {
        gl_render_init();
    }
    if (!gl_ready) {
        return;
    }

    last_mesh_keys = keys_collected;
    last_mesh_level = maze.level();
    build_world_mesh(maze, keys_collected);
}

void gl_render_world(const Maze& maze, const Player& player, int keys_collected, int level) {
    if (!gl_ready) {
        gl_render_init();
    }
    if (!gl_ready) {
        return;
    }

    if (keys_collected != last_mesh_keys || maze.level() != last_mesh_level) {
        gl_render_set_maze(maze, keys_collected);
    }

    const float max_depth = std::max(5.0f, MAX_DEPTH - static_cast<float>(level - 1) * 0.55f);
    const float eye_x = player.x;
    const float eye_y = 0.5f;
    const float eye_z = player.y;
    const float dir_x = std::cos(player.angle);
    const float dir_z = std::sin(player.angle);

    const float aspect = 640.0f / 480.0f;
    const float hfov = 2.0f * std::atan(FOV);
    const float vfov = 2.0f * std::atan(std::tan(hfov * 0.5f) / aspect);

    const Mat4 proj = mat4_perspective(vfov, aspect, 0.05f, max_depth + 4.0f);
    const Mat4 view = mat4_look_at(eye_x, eye_y, eye_z, eye_x + dir_x, eye_y, eye_z + dir_z);
    const Mat4 mvp = mat4_mul(proj, view);

    glViewport(0, 0, 640, 480);
    glDisable(GL_SCISSOR_TEST);
    glClearColor(
        static_cast<float>(COLOR_RICH_BLACK.r) / 255.0f,
        static_cast<float>(COLOR_RICH_BLACK.g) / 255.0f,
        static_cast<float>(COLOR_RICH_BLACK.b) / 255.0f,
        1.0f);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    if (world_vertex_count <= 0) {
        return;
    }

    glUseProgram(world_program);
    glUniformMatrix4fv(world_u_mvp, 1, GL_FALSE, mvp.m);
    glUniform3f(world_u_camera_pos, eye_x, eye_y, eye_z);
    glUniform3f(
        world_u_fog_color,
        static_cast<float>(COLOR_RICH_BLACK.r) / 255.0f,
        static_cast<float>(COLOR_RICH_BLACK.g) / 255.0f,
        static_cast<float>(COLOR_RICH_BLACK.b) / 255.0f);
    glUniform1f(world_u_max_depth, max_depth);
    glUniform1f(world_u_fog_strength, FOG_STRENGTH);

    glBindVertexArray(world_vao);
    glDrawArrays(GL_TRIANGLES, 0, world_vertex_count);
    glBindVertexArray(0);
}
