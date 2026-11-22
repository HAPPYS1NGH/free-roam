// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "FreeRoam",
    platforms: [.macOS(.v14)],
    dependencies: [
        .package(url: "https://github.com/sparkle-project/Sparkle", exact: "2.10.1"),
    ],
    targets: [
        // scripts/bundle.sh copies Info.plist, Resources and Sparkle.framework
        // into Free Roam.app.
        .executableTarget(
            name: "FreeRoam",
            dependencies: [.product(name: "Sparkle", package: "Sparkle")],
            path: "Sources/FreeRoam",
            exclude: ["Info.plist", "Resources"],
            // The framework sits in Contents/Frameworks, not next to the binary.
            linkerSettings: [.unsafeFlags(["-Xlinker", "-rpath", "-Xlinker", "@executable_path/../Frameworks"])]
        ),
        .testTarget(name: "FreeRoamTests", dependencies: ["FreeRoam"], path: "Tests/FreeRoamTests"),
    ]
)
