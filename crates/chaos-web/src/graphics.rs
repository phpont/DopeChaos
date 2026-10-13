use chaos_core::{Parameters, State, rk4_step};
use wasm_bindgen::JsCast;
use web_sys::{
    HtmlCanvasElement, WebGl2RenderingContext as Gl, WebGlBuffer, WebGlProgram, WebGlShader,
    WebGlUniformLocation, WebGlVertexArrayObject,
};

const VERTEX_SHADER: &str = include_str!("shaders/trajectory.vert");
const FRAGMENT_SHADER: &str = include_str!("shaders/trajectory.frag");
const SAMPLE_COUNT: usize = 14_000;
const BURN_IN: usize = 1_000;
const STEP: f64 = 0.005;

pub struct Renderer {
    gl: Gl,
    program: WebGlProgram,
    buffer: WebGlBuffer,
    vao: WebGlVertexArrayObject,
    aspect: WebGlUniformLocation,
    vertex_count: i32,
}

impl Renderer {
    pub fn new(canvas: &HtmlCanvasElement) -> Result<Self, String> {
        let vertices = trajectory()?;

        let gl = canvas
            .get_context("webgl2")
            .map_err(|error| format!("WebGL2 initialization failed: {error:?}"))?
            .ok_or_else(|| "WebGL2 is unavailable.".to_string())?
            .dyn_into::<Gl>()
            .map_err(|_| "Invalid WebGL2 context.".to_string())?;

        let vertex = compile_shader(&gl, Gl::VERTEX_SHADER, VERTEX_SHADER)?;
        let fragment = match compile_shader(&gl, Gl::FRAGMENT_SHADER, FRAGMENT_SHADER) {
            Ok(shader) => shader,
            Err(error) => {
                gl.delete_shader(Some(&vertex));
                return Err(error);
            }
        };

        let linked = link_program(&gl, &vertex, &fragment);
        gl.delete_shader(Some(&vertex));
        gl.delete_shader(Some(&fragment));

        let program = linked?;

        let buffer = match gl.create_buffer() {
            Some(buffer) => buffer,
            None => {
                gl.delete_program(Some(&program));
                return Err("Could not create vertex buffer.".into());
            }
        };

        let vao = match gl.create_vertex_array() {
            Some(vao) => vao,
            None => {
                gl.delete_buffer(Some(&buffer));
                gl.delete_program(Some(&program));
                return Err("Could not create vertex array.".into());
            }
        };

        let aspect = match gl.get_uniform_location(&program, "u_aspect") {
            Some(location) => location,
            None => {
                gl.delete_vertex_array(Some(&vao));
                gl.delete_buffer(Some(&buffer));
                gl.delete_program(Some(&program));
                return Err("Shader uniform u_aspect is missing.".into());
            }
        };

        gl.bind_vertex_array(Some(&vao));
        gl.bind_buffer(Gl::ARRAY_BUFFER, Some(&buffer));

        let positions = js_sys::Float32Array::from(vertices.as_slice());
        gl.buffer_data_with_array_buffer_view(Gl::ARRAY_BUFFER, &positions, Gl::STATIC_DRAW);

        gl.enable_vertex_attrib_array(0);
        gl.vertex_attrib_pointer_with_i32(0, 3, Gl::FLOAT, false, 0, 0);

        gl.bind_vertex_array(None);
        gl.bind_buffer(Gl::ARRAY_BUFFER, None);

        Ok(Self {
            gl,
            program,
            buffer,
            vao,
            aspect,
            vertex_count: (vertices.len() / 3) as i32,
        })
    }

    pub fn draw(&self, width: u32, height: u32) {
        if width == 0 || height == 0 {
            return;
        }

        self.gl.viewport(0, 0, width as i32, height as i32);
        self.gl.clear_color(0.039, 0.047, 0.063, 1.0);
        self.gl.clear(Gl::COLOR_BUFFER_BIT | Gl::DEPTH_BUFFER_BIT);
        self.gl.enable(Gl::DEPTH_TEST);

        self.gl.use_program(Some(&self.program));
        self.gl
            .uniform1f(Some(&self.aspect), width as f32 / height as f32);
        self.gl.bind_vertex_array(Some(&self.vao));
        self.gl.draw_arrays(Gl::LINE_STRIP, 0, self.vertex_count);
        self.gl.bind_vertex_array(None);
        self.gl.use_program(None);
    }
}

impl Drop for Renderer {
    fn drop(&mut self) {
        self.gl.delete_vertex_array(Some(&self.vao));
        self.gl.delete_buffer(Some(&self.buffer));
        self.gl.delete_program(Some(&self.program));
    }
}

fn trajectory() -> Result<Vec<f32>, String> {
    let mut state = State {
        x: 1.0,
        y: 1.0,
        z: 1.0,
    };
    let params = Parameters::default();
    let mut vertices = Vec::with_capacity(SAMPLE_COUNT * 3);

    for index in 0..(BURN_IN + SAMPLE_COUNT) {
        state = rk4_step(state, params, STEP)
            .map_err(|error| format!("Lorenz integration failed: {error:?}"))?;

        if index >= BURN_IN {
            vertices.extend_from_slice(&[state.x as f32, state.y as f32, state.z as f32]);
        }
    }

    Ok(vertices)
}

fn compile_shader(gl: &Gl, kind: u32, source: &str) -> Result<WebGlShader, String> {
    let shader = gl
        .create_shader(kind)
        .ok_or_else(|| "Could not create shader.".to_string())?;

    gl.shader_source(&shader, source);
    gl.compile_shader(&shader);

    if gl
        .get_shader_parameter(&shader, Gl::COMPILE_STATUS)
        .as_bool()
        == Some(true)
    {
        return Ok(shader);
    }

    let error = gl
        .get_shader_info_log(&shader)
        .unwrap_or_else(|| "Unknown shader compilation error.".into());

    gl.delete_shader(Some(&shader));
    Err(error)
}

fn link_program(
    gl: &Gl,
    vertex: &WebGlShader,
    fragment: &WebGlShader,
) -> Result<WebGlProgram, String> {
    let program = gl
        .create_program()
        .ok_or_else(|| "Could not create shader program.".to_string())?;

    gl.attach_shader(&program, vertex);
    gl.attach_shader(&program, fragment);
    gl.link_program(&program);

    if gl
        .get_program_parameter(&program, Gl::LINK_STATUS)
        .as_bool()
        == Some(true)
    {
        return Ok(program);
    }

    let error = gl
        .get_program_info_log(&program)
        .unwrap_or_else(|| "Unknown program linking error.".into());

    gl.delete_program(Some(&program));
    Err(error)
}
