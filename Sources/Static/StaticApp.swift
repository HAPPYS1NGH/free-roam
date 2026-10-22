import SwiftUI

@main
struct StaticApp: App {
    @State private var menu = StatusMenuModel()

    init() {
        #if DEBUG
        if CommandLine.arguments.contains("--probe") { PermissionProbe.printAndExit() }
        #endif
    }

    var body: some Scene {
        MenuBarExtra("Static", systemImage: "radio") {
            StatusMenu(model: menu)
        }
    }
}
