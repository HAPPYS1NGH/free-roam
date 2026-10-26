import CoreGraphics
import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers
@testable import FreeRoam

struct StationDetailsTests {
    private func track(_ album: String) -> Track {
        Track(title: "", artist: "", album: album, duration: 180)
    }

    @Test func picksTheFirstTrackOfEachOfTheFirstFourAlbums() {
        let tracks = ["A", "A", "B", "A", "C", "B", "D", "E"].map(track)
        #expect(StationDetails.coverTracks(tracks) == [1, 3, 5, 7])
    }

    @Test func picksFewerWhenThePlaylistHasFewerAlbums() {
        #expect(StationDetails.coverTracks(["A", "B", "A"].map(track)) == [1, 2])
        #expect(StationDetails.coverTracks([]).isEmpty)
    }

    @Test func picksCoversFromAlbumsAlone() {
        #expect(StationDetails.coverTracks(albums: ["A", "A", "B", "C", "B", "D", "E"]) == [1, 3, 4, 6])
        #expect(StationDetails.coverTracks(albums: []).isEmpty)
    }

    @Test func dropsTheLongestUnseenLogosBeyondTheLimit() {
        let order = ["a", "b", "c", "d", "e"]
        #expect(StationDetails.logosToDrop(order, onScreen: [], limit: 5).isEmpty)
        #expect(StationDetails.logosToDrop(order, onScreen: [], limit: 3) == ["a", "b"])
        // Never one on screen, even when that leaves the cache over its limit.
        #expect(StationDetails.logosToDrop(order, onScreen: ["a"], limit: 3) == ["b", "c"])
        #expect(StationDetails.logosToDrop(order, onScreen: Set(order), limit: 3).isEmpty)
    }

    @Test func tilesFourCoversLeftToRightTopToBottom() async throws {
        let colours: [(UInt8, UInt8, UInt8)] = [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 255)]
        let logo = try #require(await StationDetails.logo(from: colours.map(png)))
        let size = StationDetails.logoPixels
        #expect(logo.width == size && logo.height == size)

        let quarter = size / 4
        #expect(try pixel(logo, x: quarter, y: quarter) == colours[0])
        #expect(try pixel(logo, x: size - quarter, y: quarter) == colours[1])
        #expect(try pixel(logo, x: quarter, y: size - quarter) == colours[2])
        #expect(try pixel(logo, x: size - quarter, y: size - quarter) == colours[3])
    }

    @Test func showsTheFirstCoverAloneWhenThereAreFewerThanFour() async throws {
        let logo = try #require(await StationDetails.logo(from: [png(0, 255, 0), png(255, 0, 0)]))
        let size = StationDetails.logoPixels
        #expect(try pixel(logo, x: size / 4, y: size / 4) == (0, 255, 0))
        #expect(try pixel(logo, x: size - size / 4, y: size - size / 4) == (0, 255, 0))
    }

    @Test func hasNoLogoWithoutCoversThatDecode() async {
        #expect(await StationDetails.logo(from: []) == nil)
        #expect(await StationDetails.logo(from: [Data("not an image".utf8)]) == nil)
    }

    /// A 2×2 PNG of one colour.
    private func png(_ red: UInt8, _ green: UInt8, _ blue: UInt8) -> Data {
        let context = CGContext(
            data: nil, width: 2, height: 2, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )!
        context.setFillColor(red: Double(red) / 255, green: Double(green) / 255, blue: Double(blue) / 255, alpha: 1)
        context.fill(CGRect(x: 0, y: 0, width: 2, height: 2))
        let data = NSMutableData()
        let destination = CGImageDestinationCreateWithData(data, UTType.png.identifier as CFString, 1, nil)!
        CGImageDestinationAddImage(destination, context.makeImage()!, nil)
        CGImageDestinationFinalize(destination)
        return data as Data
    }

    /// Reads one pixel, with y growing downwards as on screen.
    private func pixel(_ image: CGImage, x: Int, y: Int) throws -> (UInt8, UInt8, UInt8) {
        var rgba: [UInt8] = [0, 0, 0, 0]
        let context = try #require(CGContext(
            data: &rgba, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ))
        context.draw(image, in: CGRect(x: -x, y: y - image.height + 1, width: image.width, height: image.height))
        return (rgba[0], rgba[1], rgba[2])
    }
}
