// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "FreeRoam",
    platforms: [.macOS(.v14)],
    targets: [
        // scripts/bundle.sh copies Info.plist and Resources into Free Roam.app.
        .executableTarget(name: "FreeRoam", path: "Sources/FreeRoam", exclude: ["Info.plist", "Resources"]),
        .testTarget(name: "FreeRoamTests", dependencies: ["FreeRoam"], path: "Tests/FreeRoamTests"),
    ]
)
