import AppKit
import Foundation

private func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("image-diff: \(message)\n".utf8))
    exit(1)
}

guard CommandLine.arguments.count == 5 else {
    fail("usage: image-diff.swift <reference.png> <actual.png> <overlay.png> <diff.png>")
}

let referenceURL = URL(fileURLWithPath: CommandLine.arguments[1])
let actualURL = URL(fileURLWithPath: CommandLine.arguments[2])
let overlayURL = URL(fileURLWithPath: CommandLine.arguments[3])
let diffURL = URL(fileURLWithPath: CommandLine.arguments[4])

guard let referenceImage = NSImage(contentsOf: referenceURL),
      let actualImage = NSImage(contentsOf: actualURL) else {
    fail("could not read both input images")
}

func dimensions(_ image: NSImage) -> (Int, Int) {
    guard let representation = image.representations.first else { return (0, 0) }
    return (representation.pixelsWide, representation.pixelsHigh)
}

let referenceSize = dimensions(referenceImage)
let actualSize = dimensions(actualImage)
let width = min(referenceSize.0, actualSize.0)
let height = min(referenceSize.1, actualSize.1)
guard width > 0, height > 0 else { fail("input image dimensions are invalid") }

func rgbaPixels(from image: NSImage, width: Int, height: Int) -> [UInt8] {
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    guard let context = CGContext(
        data: &pixels,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { fail("could not create a bitmap context") }

    var proposed = NSRect(x: 0, y: 0, width: width, height: height)
    guard let cgImage = image.cgImage(forProposedRect: &proposed, context: nil, hints: nil) else {
        fail("could not decode an input image")
    }
    context.interpolationQuality = .high
    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
    return pixels
}

func writePNG(_ pixels: [UInt8], width: Int, height: Int, to url: URL) {
    let data = Data(pixels)
    guard let provider = CGDataProvider(data: data as CFData),
          let image = CGImage(
            width: width,
            height: height,
            bitsPerComponent: 8,
            bitsPerPixel: 32,
            bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
            provider: provider,
            decode: nil,
            shouldInterpolate: false,
            intent: .defaultIntent
          ) else { fail("could not create an output image") }

    let representation = NSBitmapImageRep(cgImage: image)
    guard let encoded = representation.representation(using: .png, properties: [:]) else {
        fail("could not encode output PNG")
    }
    do {
        try encoded.write(to: url, options: .atomic)
    } catch {
        fail("could not write \(url.path): \(error.localizedDescription)")
    }
}

let reference = rgbaPixels(from: referenceImage, width: width, height: height)
let actual = rgbaPixels(from: actualImage, width: width, height: height)
var overlay = [UInt8](repeating: 255, count: reference.count)
var difference = [UInt8](repeating: 255, count: reference.count)
var absoluteError: UInt64 = 0
var changedPixels: UInt64 = 0

for index in stride(from: 0, to: reference.count, by: 4) {
    var pixelChanged = false
    for channel in 0..<3 {
        overlay[index + channel] = UInt8((UInt16(reference[index + channel]) + UInt16(actual[index + channel])) / 2)
        let delta = abs(Int(reference[index + channel]) - Int(actual[index + channel]))
        absoluteError += UInt64(delta)
        pixelChanged = pixelChanged || delta > 24
        difference[index + channel] = UInt8(min(255, delta * 4))
    }
    overlay[index + 3] = 255
    difference[index + 3] = 255
    if pixelChanged { changedPixels += 1 }
}

writePNG(overlay, width: width, height: height, to: overlayURL)
writePNG(difference, width: width, height: height, to: diffURL)

let channelCount = Double(width * height * 3)
let mae = Double(absoluteError) / channelCount
let similarity = max(0, 100 * (1 - mae / 255))
let changedPercent = 100 * Double(changedPixels) / Double(width * height)
let report: [String: Any] = [
    "width": width,
    "height": height,
    "referenceHeight": referenceSize.1,
    "actualHeight": actualSize.1,
    "meanAbsoluteError": (mae * 1000).rounded() / 1000,
    "pixelSimilarityPercent": (similarity * 100).rounded() / 100,
    "changedPixelsPercent": (changedPercent * 100).rounded() / 100
]
let json = try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys])
print(String(decoding: json, as: UTF8.self))
