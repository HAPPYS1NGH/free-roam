import SwiftUI

enum SettingsTab: Hashable {
    case stations
    case general
}

/// Which Settings tab is showing. The app delegate owns it, so the menu can
/// open Settings straight on the tab it needs.
@MainActor @Observable
final class SettingsNavigation {
    var tab = SettingsTab.stations
}

/// The Settings window: your stations, and the rest of Free Roam's settings.
struct SettingsView: View {
    let navigation: SettingsNavigation
    let stations: StationList
    let details: StationDetails
    let style: WheelStyle?
    let status: StatusMenuModel
    let updater: Updater
    let selectApp: (MusicApp) -> Void

    var body: some View {
        TabView(selection: Binding(get: { navigation.tab }, set: { navigation.tab = $0 })) {
            StationsSettingsView(stations: stations, details: details, style: style, selectApp: selectApp)
                .tabItem { Label("Stations", systemImage: "radio") }
                .tag(SettingsTab.stations)
            GeneralSettingsView(status: status, updater: updater)
                .tabItem { Label("General", systemImage: "gearshape") }
                .tag(SettingsTab.general)
        }
    }
}
