use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_cli::{CliExt, Matches};

pub const CLI_SECOND_INSTANCE_EVENT: &str = "cli-second-instance";

#[derive(Debug, Clone, Serialize)]
pub struct ForwardedCliInvocation {
    pub args: Vec<String>,
    pub cwd: Option<String>,
}

fn build_forwarded_cli_invocation(args: Vec<String>, cwd: String) -> ForwardedCliInvocation {
    ForwardedCliInvocation {
        args,
        cwd: (!cwd.is_empty()).then_some(cwd),
    }
}

#[tauri::command]
pub fn parse_cli_matches_from_args(app: AppHandle, args: Vec<String>) -> Result<Matches, String> {
    app.cli()
        .matches_from(args)
        .map_err(|error| error.to_string())
}

pub fn handle_forwarded_cli_invocation<R: Runtime>(
    app: &AppHandle<R>,
    args: Vec<String>,
    cwd: String,
) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }

    let _ = app.emit(
        CLI_SECOND_INSTANCE_EVENT,
        build_forwarded_cli_invocation(args, cwd),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_forwarded_cli_invocation_omits_empty_cwd() {
        let invocation = build_forwarded_cli_invocation(vec!["skymap".to_string()], String::new());

        assert_eq!(invocation.args, vec!["skymap"]);
        assert_eq!(invocation.cwd, None);
    }

    #[test]
    fn build_forwarded_cli_invocation_preserves_non_empty_cwd() {
        let invocation = build_forwarded_cli_invocation(
            vec!["skymap".to_string(), "--focus".to_string()],
            "D:/Projects".to_string(),
        );

        assert_eq!(invocation.cwd.as_deref(), Some("D:/Projects"));
        assert_eq!(invocation.args.len(), 2);
    }

    #[test]
    fn forwarded_cli_invocation_serializes_payload_shape() {
        let payload = build_forwarded_cli_invocation(
            vec!["skymap".to_string(), "open".to_string()],
            "C:/Observatory".to_string(),
        );

        let json = serde_json::to_value(payload).expect("cli invocation should serialize");
        assert_eq!(json["args"][0], "skymap");
        assert_eq!(json["args"][1], "open");
        assert_eq!(json["cwd"], "C:/Observatory");
    }
}
