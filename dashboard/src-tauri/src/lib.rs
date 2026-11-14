use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Manager};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Game {
    id: String,
    title: String,
    game_path: String,
    cover: String,
    banner: String,
    #[serde(default)]
    logo: String,
    #[serde(default)]
    launch_type: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Library {
    emulator_path: String,
    launch_args: Vec<String>,
    games: Vec<Game>,
}

fn library_file(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Cannot locate app data folder: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Cannot create app data folder: {error}"))?;
    Ok(directory.join("games.json"))
}

fn default_library() -> Result<Library, String> {
    let profile = std::env::var_os("USERPROFILE")
        .ok_or_else(|| "Cannot determine the current Windows user profile.".to_owned())?;
    let kyty = PathBuf::from(profile)
        .join("Downloads")
        .join("KytyPS5-2026-11-12-58ca8d1-Windows-x64");
    Ok(Library {
        emulator_path: kyty
            .join("kyty_emulator.exe")
            .to_string_lossy()
            .into_owned(),
        launch_args: vec![
            "--game".to_owned(),
            "{gamePath}".to_owned(),
            "--fullscreen".to_owned(),
        ],
        games: vec![Game {
            id: "ppsa37001".to_owned(),
            title: "PPSA37001".to_owned(),
            game_path: kyty
                .join("Games")
                .join("PPSA37001")
                .join("PPSA37001-app")
                .join("eboot.bin")
                .to_string_lossy()
                .into_owned(),
            cover: "/assets/Images/PS5/Background/PS5Library.jpg".to_owned(),
            banner: "/assets/Images/PS5/Background/PS5Background1.jpg".to_owned(),
            logo: String::new(),
            launch_type: "kyty".to_owned(),
        }],
    })
}

fn read_library(app: &AppHandle) -> Result<Library, String> {
    let path = library_file(app)?;
    if !path.exists() {
        let library = default_library()?;
        write_library(&path, &library)?;
        return Ok(library);
    }

    let contents = fs::read_to_string(&path)
        .map_err(|error| format!("Cannot read {}: {error}", path.display()))?;
    serde_json::from_str(&contents).map_err(|error| format!("Invalid {}: {error}", path.display()))
}

fn write_library(path: &Path, library: &Library) -> Result<(), String> {
    let mut ids = HashSet::new();
    for game in &library.games {
        if game.id.trim().is_empty()
            || game.title.trim().is_empty()
            || game.game_path.trim().is_empty()
        {
            return Err("Each game needs an ID, title, and game path.".to_owned());
        }
        if !ids.insert(&game.id) {
            return Err(format!("Duplicate game ID: {}", game.id));
        }
    }

    let contents = serde_json::to_string_pretty(library)
        .map_err(|error| format!("Cannot encode game library: {error}"))?;
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, contents)
        .map_err(|error| format!("Cannot write {}: {error}", temporary.display()))?;
    fs::rename(&temporary, path)
        .map_err(|error| format!("Cannot update {}: {error}", path.display()))
}

#[tauri::command]
fn load_library(app: AppHandle) -> Result<Library, String> {
    read_library(&app)
}

#[tauri::command]
fn save_library(app: AppHandle, library: Library) -> Result<(), String> {
    let path = library_file(&app)?;
    write_library(&path, &library)
}

#[tauri::command]
fn launch_game(app: AppHandle, game_id: String) -> Result<String, String> {
    let library = read_library(&app)?;
    let game = library
        .games
        .iter()
        .find(|game| game.id == game_id)
        .ok_or_else(|| format!("Game is not in the library: {game_id}"))?;
    let emulator = Path::new(&library.emulator_path);
    if !emulator.is_file() {
        return Err(format!(
            "Kyty executable was not found: {}",
            emulator.display()
        ));
    }
    if !Path::new(&game.game_path).exists() {
        return Err(format!("Game path was not found: {}", game.game_path));
    }
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Dashboard window is unavailable.".to_owned())?;

    let arguments = library.launch_args.iter().map(|argument| {
        argument
            .replace("{gamePath}", &game.game_path)
            .replace("{gameId}", &game.id)
            .replace("{title}", &game.title)
    });
    let mut child: Child = Command::new(emulator)
        .args(arguments)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Could not start Kyty: {error}"))?;
    let minimize_result = window.minimize();
    let monitor_app = app.clone();

    thread::spawn(move || {
        wait_for_process(&mut child);
        if let Some(window) = monitor_app.get_webview_window("main") {
            let result = window
                .unminimize()
                .and_then(|_| window.show())
                .and_then(|_| window.set_focus());
            if let Err(error) = result {
                eprintln!("Could not restore dashboard after Kyty closed: {error}");
            }
        }
    });
    minimize_result
        .map_err(|error| format!("Kyty started, but dashboard could not minimize: {error}"))?;

    Ok(format!("Started Kyty for {}.", game.title))
}

fn wait_for_process(child: &mut Child) {
    loop {
        match child.try_wait() {
            Ok(Some(_)) => return,
            Ok(None) => thread::sleep(Duration::from_secs(1)),
            Err(error) => {
                eprintln!("Could not monitor Kyty process: {error}");
                return;
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_library,
            save_library,
            launch_game
        ])
        .run(tauri::generate_context!())
        .expect("error while running PS5 Reborn dashboard");
}
