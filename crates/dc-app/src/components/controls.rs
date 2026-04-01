use dc_protocol::{
    default_template, templates_for, IkedaParams, JuliaParams, PeterDeJongParams, RenderFamily,
};
use leptos::*;

use crate::app::SystemKind;

#[component]
pub fn Controls(
    system_kind:       ReadSignal<SystemKind>,
    set_system_kind:   WriteSignal<SystemKind>,
    render_family:     ReadSignal<RenderFamily>,
    set_render_family: WriteSignal<RenderFamily>,
    template:          ReadSignal<String>,
    set_template:      WriteSignal<String>,
    julia_params:      ReadSignal<JuliaParams>,
    set_julia_params:  WriteSignal<JuliaParams>,
    pdj_params:        ReadSignal<PeterDeJongParams>,
    set_pdj_params:    WriteSignal<PeterDeJongParams>,
    ikeda_params:      ReadSignal<IkedaParams>,
    set_ikeda_params:  WriteSignal<IkedaParams>,
) -> impl IntoView {
    let randomize = move |_: web_sys::MouseEvent| {
        use js_sys::Math::random;
        match system_kind.get_untracked() {
            SystemKind::Julia => set_julia_params.update(|p| {
                p.cx = random() * 4.0 - 2.0;
                p.cy = random() * 4.0 - 2.0;
            }),
            SystemKind::PeterDeJong => set_pdj_params.update(|p| {
                p.a = random() * 4.0 - 2.0;
                p.b = random() * 4.0 - 2.0;
                p.c = random() * 4.0 - 2.0;
                p.d = random() * 4.0 - 2.0;
            }),
            SystemKind::Ikeda => set_ikeda_params.update(|p| {
                p.u = random() * 0.4 + 0.7;
            }),
        }
    };

    let reset = move |_: web_sys::MouseEvent| match system_kind.get_untracked() {
        SystemKind::Julia       => set_julia_params.set(JuliaParams::default()),
        SystemKind::PeterDeJong => set_pdj_params.set(PeterDeJongParams::default()),
        SystemKind::Ikeda       => set_ikeda_params.set(IkedaParams::default()),
    };

    view! {
        // ── System ────────────────────────────────────────────────────────
        <div class="control-section">
            <p class="section-label">"System"</p>
            <div class="control-row">
                <select
                    prop:value=move || match system_kind.get() {
                        SystemKind::Julia       => "julia",
                        SystemKind::PeterDeJong => "pdj",
                        SystemKind::Ikeda       => "ikeda",
                    }
                    on:change=move |e| {
                        let kind = match event_target_value(&e).as_str() {
                            "pdj"   => SystemKind::PeterDeJong,
                            "ikeda" => SystemKind::Ikeda,
                            _       => SystemKind::Julia,
                        };
                        set_system_kind.set(kind);
                    }
                >
                    <option value="julia">"Julia Set"</option>
                    <option value="pdj">"Peter de Jong"</option>
                    <option value="ikeda">"Ikeda Map"</option>
                </select>
            </div>
        </div>

        // ── Render mode ───────────────────────────────────────────────────
        <div class="control-section">
            <p class="section-label">"Render Mode"</p>
            <div class="control-row">
                <select
                    prop:value=move || match render_family.get() {
                        RenderFamily::Pixel   => "pixel",
                        RenderFamily::Ascii   => "ascii",
                        RenderFamily::Density => "density",
                    }
                    on:change=move |e| {
                        let family = match event_target_value(&e).as_str() {
                            "ascii"   => RenderFamily::Ascii,
                            "density" => RenderFamily::Density,
                            _         => RenderFamily::Pixel,
                        };
                        set_template.set(default_template(&family).to_string());
                        set_render_family.set(family);
                    }
                >
                    <option value="pixel">"Pixel"</option>
                    <option value="ascii">"ASCII"</option>
                    <option value="density">"Density"</option>
                </select>
            </div>
        </div>

        // ── Template ──────────────────────────────────────────────────────
        <div class="control-section">
            <p class="section-label">"Template"</p>
            <div class="control-row">
                {move || {
                    let family  = render_family.get();
                    let current = template.get();
                    let infos   = templates_for(&family);
                    view! {
                        <select
                            prop:value=current.clone()
                            on:change=move |e| set_template.set(event_target_value(&e))
                        >
                            {infos.iter().map(|t| view! {
                                <option value=t.id>{t.label}</option>
                            }).collect_view()}
                        </select>
                    }
                }}
            </div>
        </div>

        // ── Julia params ──────────────────────────────────────────────────
        {move || (system_kind.get() == SystemKind::Julia).then(|| view! {
            <div class="control-section">
                <p class="section-label">"Julia — c"</p>
                <Slider label="Re(c)" min=-2.0 max=2.0 step=0.001
                    value=move || julia_params.get().cx
                    on_change=move |v| set_julia_params.update(|p| p.cx = v)
                />
                <Slider label="Im(c)" min=-2.0 max=2.0 step=0.001
                    value=move || julia_params.get().cy
                    on_change=move |v| set_julia_params.update(|p| p.cy = v)
                />
                <Slider label="Zoom" min=0.1 max=5.0 step=0.01
                    value=move || julia_params.get().zoom
                    on_change=move |v| set_julia_params.update(|p| p.zoom = v)
                />
                <Slider label="Cx offset" min=-2.0 max=2.0 step=0.01
                    value=move || julia_params.get().center_x
                    on_change=move |v| set_julia_params.update(|p| p.center_x = v)
                />
                <Slider label="Cy offset" min=-2.0 max=2.0 step=0.01
                    value=move || julia_params.get().center_y
                    on_change=move |v| set_julia_params.update(|p| p.center_y = v)
                />
                <Slider label="Max iter" min=50.0 max=800.0 step=10.0
                    value=move || julia_params.get().max_iter as f64
                    on_change=move |v| set_julia_params.update(|p| p.max_iter = v as u32)
                />
            </div>
        })}

        // ── Peter de Jong params ──────────────────────────────────────────
        {move || (system_kind.get() == SystemKind::PeterDeJong).then(|| view! {
            <div class="control-section">
                <p class="section-label">"Peter de Jong"</p>
                <Slider label="a" min=-3.0 max=3.0 step=0.001
                    value=move || pdj_params.get().a
                    on_change=move |v| set_pdj_params.update(|p| p.a = v)
                />
                <Slider label="b" min=-3.0 max=3.0 step=0.001
                    value=move || pdj_params.get().b
                    on_change=move |v| set_pdj_params.update(|p| p.b = v)
                />
                <Slider label="c" min=-3.0 max=3.0 step=0.001
                    value=move || pdj_params.get().c
                    on_change=move |v| set_pdj_params.update(|p| p.c = v)
                />
                <Slider label="d" min=-3.0 max=3.0 step=0.001
                    value=move || pdj_params.get().d
                    on_change=move |v| set_pdj_params.update(|p| p.d = v)
                />
            </div>
        })}

        // ── Ikeda params ──────────────────────────────────────────────────
        {move || (system_kind.get() == SystemKind::Ikeda).then(|| view! {
            <div class="control-section">
                <p class="section-label">"Ikeda Map"</p>
                <Slider label="u" min=0.5 max=1.1 step=0.001
                    value=move || ikeda_params.get().u
                    on_change=move |v| set_ikeda_params.update(|p| p.u = v)
                />
                <Slider label="Scale" min=0.5 max=6.0 step=0.05
                    value=move || ikeda_params.get().scale
                    on_change=move |v| set_ikeda_params.update(|p| p.scale = v)
                />
                <Slider label="Cx offset" min=-1.0 max=1.0 step=0.01
                    value=move || ikeda_params.get().center_x
                    on_change=move |v| set_ikeda_params.update(|p| p.center_x = v)
                />
                <Slider label="Cy offset" min=-1.0 max=1.0 step=0.01
                    value=move || ikeda_params.get().center_y
                    on_change=move |v| set_ikeda_params.update(|p| p.center_y = v)
                />
            </div>
        })}

        // ── Actions ───────────────────────────────────────────────────────
        <div class="control-section">
            <div class="btn-row">
                <button class="btn" on:click=randomize>"Randomize"</button>
                <button class="btn" on:click=reset>"Reset"</button>
            </div>
        </div>
    }
}

// ── Reusable slider ────────────────────────────────────────────────────────

#[component]
fn Slider(
    label: &'static str,
    min: f64,
    max: f64,
    step: f64,
    value: impl Fn() -> f64 + Copy + 'static,
    on_change: impl Fn(f64) + 'static,
) -> impl IntoView {
    view! {
        <div class="control-row">
            <label>
                {label}
                <span>{move || format!("{:.3}", value())}</span>
            </label>
            <input
                type="range"
                min=min.to_string()
                max=max.to_string()
                step=step.to_string()
                prop:value=move || value().to_string()
                on:input=move |e| {
                    if let Ok(v) = event_target_value(&e).parse::<f64>() {
                        on_change(v);
                    }
                }
            />
        </div>
    }
}
