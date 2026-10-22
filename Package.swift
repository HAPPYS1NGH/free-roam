// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Static",
    platforms: [.macOS(.v14)],
    targets: [
        // scripts/bundle.sh copies Info.plist and Resources into Static.app.
        .executableTarget(name: "Static", path: "Sources/Static", exclude: ["Info.plist", "Resources"]),
        .testTarget(name: "StaticTests", dependencies: ["Static"], path: "Tests/StaticTests"),
    ]
)
