// Verhindert, dass unter Windows ein Konsolenfenster mitläuft.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    openprintcost_lib::run()
}
