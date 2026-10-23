// Prevents a console window from running along on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // `--version` prints the version and exits — useful for scripts and to
    // verify an installed package. Without this the app would try to open a
    // window, which fails on a headless machine.
    if std::env::args()
        .skip(1)
        .any(|arg| arg == "--version" || arg == "-V")
    {
        println!("openprintcost {}", env!("CARGO_PKG_VERSION"));
        return;
    }

    openprintcost_lib::run()
}
